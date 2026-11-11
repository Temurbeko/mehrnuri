export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <div className="skel skel-dark h-72 rounded-[28px] sm:h-80" />
      <div className="skel mx-auto h-4 w-2/3 rounded-full" />
      <div className="skel h-6 w-40 rounded-full" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel h-32 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
