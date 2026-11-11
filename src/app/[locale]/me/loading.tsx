export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-xl space-y-5">
      <div className="skel h-8 w-40 rounded-full" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
