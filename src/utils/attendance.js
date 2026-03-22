export const normalizeDirection = (direction) => (direction || '').toString().trim().toUpperCase();

export const parseDate = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const match = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match) {
      return new Date(Number(match[1]));
    }

    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && value.trim().length > 0) {
      if (value.trim().length === 10) {
        return new Date(numericValue * 1000);
      }
      return new Date(numericValue);
    }
  }

  if (typeof value === 'number') {
    if (String(value).length === 10) {
      return new Date(value * 1000);
    }
    return new Date(value);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isValidLocation = (location) => {
  if (!location || typeof location !== 'object') return false;
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return !(lat === 0 && lng === 0);
};

export const getLocalDateKey = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const firstDefined = (...values) => values.find((value) => value !== null && value !== undefined && value !== '');

const buildLocation = (latValue, lngValue) => {
  const latitude = Number.parseFloat(latValue);
  const longitude = Number.parseFloat(lngValue);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const location = { latitude, longitude };
  return isValidLocation(location) ? location : null;
};

const extractDirectionalLocation = (record, direction) => {
  const upper = direction.toUpperCase();

  const explicitLocation = buildLocation(
    firstDefined(
      record[`Latitude_${upper}`],
      record[`latitude_${direction.toLowerCase()}`],
      record[`latitude_${upper.toLowerCase()}`],
      record[`Check${direction}Latitude`],
      record[`check${direction}Latitude`],
      record[`check_${direction.toLowerCase()}_latitude`]
    ),
    firstDefined(
      record[`Longitude_${upper}`],
      record[`longitude_${direction.toLowerCase()}`],
      record[`longitude_${upper.toLowerCase()}`],
      record[`Check${direction}Longitude`],
      record[`check${direction}Longitude`],
      record[`check_${direction.toLowerCase()}_longitude`]
    )
  );

  if (explicitLocation) return explicitLocation;

  const rawDirection = normalizeDirection(record.Direction || record.direction);
  if (
    rawDirection === upper &&
    firstDefined(record.Latitude, record.latitude) !== undefined &&
    firstDefined(record.Longitude, record.longitude) !== undefined
  ) {
    return buildLocation(record.Latitude || record.latitude, record.Longitude || record.longitude);
  }

  return null;
};

const extractDirectionalPhoto = (record, direction, getMediaUrl) => {
  const upper = direction.toUpperCase();
  const rawValue = firstDefined(
    record[`PhotoPath_${upper}`],
    record[`photoPath_${upper}`],
    record[`photo_path_${direction.toLowerCase()}`],
    record[`Check${direction}Photo`],
    record[`check${direction}Photo`],
    record[`check_${direction.toLowerCase()}_photo`]
  );

  if (rawValue) {
    return getMediaUrl(rawValue);
  }

  const rawDirection = normalizeDirection(record.Direction || record.direction);
  if (rawDirection === upper) {
    return getMediaUrl(
      firstDefined(record.PhotoPath, record.photoPath, record.photo_path, record.Photo, record.photo)
    );
  }

  return null;
};

const extractEmployee = (record) => ({
  _id: record.UserId || record.user_id || record.UserID || record.userId || null,
  name: record.Name || record.UserName || record.user_name || record.name || 'Unknown',
  email: record.Email || record.UserEmail || record.user_email || record.email || 'unknown@email.com',
});

export const transformAttendanceRecords = (records, currentUser, getMediaUrl) => {
  if (!Array.isArray(records)) return [];

  const groupedRecords = new Map();

  records.forEach((record, index) => {
    const rawDirection = normalizeDirection(record.Direction || record.direction);
    const rawInTime = firstDefined(record.InTime, record.in_time, record.check_in, record.CheckIn);
    const rawOutTime = firstDefined(record.OutTime, record.out_time, record.check_out, record.CheckOut);
    const rawCreatedAt = firstDefined(record.CreatedAt, record.created_at, record.DateCreated, record.date_created);
    const rawAttendanceDate = firstDefined(record.AttendanceDate, record.Attendance_Date, rawCreatedAt, rawInTime, rawOutTime);
    const baseDate = parseDate(rawAttendanceDate || rawInTime || rawOutTime || rawCreatedAt);
    const userId = firstDefined(record.UserId, record.user_id, record.UserID, record.userId, currentUser?.user_id, currentUser?.id, 'user');
    const dateKey = getLocalDateKey(baseDate || rawAttendanceDate || rawCreatedAt) || `${rawAttendanceDate || rawCreatedAt || index}`;
    const groupKey = `${userId}_${dateKey}`;

    if (!groupedRecords.has(groupKey)) {
      groupedRecords.set(groupKey, {
        Id: firstDefined(record.Id, record.id, `${groupKey}_${index}`),
        direction: rawDirection,
        date: baseDate,
        checkIn: null,
        checkOut: null,
        checkInPhoto: null,
        checkOutPhoto: null,
        checkInLocation: null,
        checkOutLocation: null,
        employee: currentUser?.role === 1 ? extractEmployee(record) : null,
        notes: firstDefined(record.Notes, record.notes, null),
        rawRecords: [],
      });
    }

    const item = groupedRecords.get(groupKey);
    item.rawRecords.push(record);
    if (!item.date || (baseDate && item.date > baseDate)) {
      item.date = baseDate;
    }

    if (currentUser?.role === 1 && !item.employee) {
      item.employee = extractEmployee(record);
    }

    if (!item.notes) {
      item.notes = firstDefined(record.Notes, record.notes, null);
    }

    const computedCheckIn = parseDate(rawInTime || (rawDirection === 'IN' ? rawCreatedAt : null));
    const computedCheckOut = parseDate(rawOutTime || (rawDirection === 'OUT' ? rawCreatedAt : null));

    if (computedCheckIn && (!item.checkIn || computedCheckIn < item.checkIn)) {
      item.checkIn = computedCheckIn;
    }

    if (computedCheckOut && (!item.checkOut || computedCheckOut > item.checkOut)) {
      item.checkOut = computedCheckOut;
    }

    const checkInPhoto = extractDirectionalPhoto(record, 'In', getMediaUrl);
    const checkOutPhoto = extractDirectionalPhoto(record, 'Out', getMediaUrl);
    const checkInLocation = extractDirectionalLocation(record, 'In');
    const checkOutLocation = extractDirectionalLocation(record, 'Out');

    if (checkInPhoto && !item.checkInPhoto) {
      item.checkInPhoto = checkInPhoto;
    }

    if (checkOutPhoto && !item.checkOutPhoto) {
      item.checkOutPhoto = checkOutPhoto;
    }

    if (checkInLocation && !item.checkInLocation) {
      item.checkInLocation = checkInLocation;
    }

    if (checkOutLocation && !item.checkOutLocation) {
      item.checkOutLocation = checkOutLocation;
    }

    const genericPhoto = getMediaUrl(
      firstDefined(record.PhotoPath, record.photoPath, record.photo_path, record.Photo, record.photo)
    );
    const genericLocation = buildLocation(
      firstDefined(record.Latitude, record.latitude),
      firstDefined(record.Longitude, record.longitude)
    );

    if (rawDirection === 'IN') {
      item.checkIn = item.checkIn || parseDate(rawCreatedAt);
      item.checkInPhoto = item.checkInPhoto || genericPhoto;
      item.checkInLocation = item.checkInLocation || genericLocation;
    }

    if (rawDirection === 'OUT') {
      item.checkOut = item.checkOut || parseDate(rawCreatedAt);
      item.checkOutPhoto = item.checkOutPhoto || genericPhoto;
      item.checkOutLocation = item.checkOutLocation || genericLocation;
    }

    if (!item.checkInPhoto && !item.checkOutPhoto && genericPhoto) {
      item.checkInPhoto = genericPhoto;
    }

    if (!item.checkInLocation && !item.checkOutLocation && genericLocation) {
      item.checkInLocation = genericLocation;
    }
  });

  return Array.from(groupedRecords.values())
    .map((item) => ({
      ...item,
      status: item.checkIn && item.checkOut ? 'completed' : item.checkIn ? 'present' : 'absent',
      photo: item.checkInPhoto || item.checkOutPhoto || null,
      location: item.checkInLocation || item.checkOutLocation || null,
    }))
    .sort((a, b) => {
      const aTime = (a.checkOut || a.checkIn || a.date)?.getTime?.() || 0;
      const bTime = (b.checkOut || b.checkIn || b.date)?.getTime?.() || 0;
      return bTime - aTime;
    });
};
