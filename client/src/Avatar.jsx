export default function Avatar({ userId = '', username = '', online = false }) {
  const colors = [
    'bg-teal-200', 'bg-red-200', 'bg-green-200', 'bg-purple-200',
    'bg-blue-200', 'bg-yellow-200', 'bg-orange-200', 'bg-pink-200',
    'bg-fuchsia-200', 'bg-rose-200'
  ];

  // Helper: deterministic string -> non-negative integer hash
  const stringHash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0; // keep as 32-bit int
    }
    return Math.abs(h);
  };

  // Try to derive an index from userId hex suffix; fall back to username hash
  let colorIndex = 0;
  if (typeof userId === 'string' && userId.length >= 10) {
    // defensive: slice rather than assume hex substring always valid
    const hexPart = userId.substring(10);
    const parsed = parseInt(hexPart, 16);
    if (!Number.isNaN(parsed)) {
      colorIndex = parsed % colors.length;
    } else {
      colorIndex = stringHash(username || 'fallback') % colors.length;
    }
  } else {
    colorIndex = stringHash(username || 'fallback') % colors.length;
  }

  const color = colors[colorIndex];

  const initial = (typeof username === 'string' && username.length > 0)
    ? username[0].toUpperCase()
    : '?';

  return (
    <div className={"w-8 h-8 relative rounded-full flex items-center " + color}>
      <div className="text-center w-full opacity-70">{initial}</div>
      {online ? (
        <div className="absolute w-3 h-3 bg-green-400 bottom-0 right-0 rounded-full border border-white" />
      ) : (
        <div className="absolute w-3 h-3 bg-gray-400 bottom-0 right-0 rounded-full border border-white" />
      )}
    </div>
  );
}
