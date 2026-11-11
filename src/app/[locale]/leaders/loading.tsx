export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <div className="skel h-8 w-44 rounded-full" />
        <div className="skel h-4 w-64 max-w-full rounded-full" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skel h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
