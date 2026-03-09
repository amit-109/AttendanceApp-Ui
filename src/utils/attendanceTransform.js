const normalizeDirection = (direction) => (direction || '').toString().trim().toUpperCase();

const getRecordTimestamp = (record = {}) =>
  record.CreatedAt || record.created_at || record.DateCreated || record.date_created || null;

export const transformAttendanceRecord = (record, { index = 0, userRole = 2, getMediaUrl } = {}) => {
  const direction = normalizeDirection(record?.Direction || record?.direction);
  const timestamp = getRecordTimestamp(record);

  return {
    direction,
    Id: record?.Id || record?.id || index,
    date: timestamp,
    checkIn: direction === 'IN' ? timestamp : null,
    checkOut: direction === 'OUT' ? timestamp : null,
    status: 'present',
    location: {
      latitude: parseFloat(record?.Latitude || record?.latitude || 0),
      longitude: parseFloat(record?.Longitude || record?.longitude || 0),
    },
    photo: typeof getMediaUrl === 'function'
      ? getMediaUrl(record?.PhotoPath || record?.photo_path || record?.Photo || record?.photo)
      : null,
    employee: userRole === 1 ? {
      _id: record?.UserId || record?.user_id,
      name: record?.UserName || record?.user_name || 'Unknown',
      email: record?.UserEmail || record?.user_email || 'unknown@email.com',
    } : null,
    notes: record?.Notes || record?.notes || null,
  };
};

export const transformAttendanceList = (records, options = {}) => {
  if (!Array.isArray(records)) return [];
  return records.map((record, index) => transformAttendanceRecord(record, { ...options, index }));
};

