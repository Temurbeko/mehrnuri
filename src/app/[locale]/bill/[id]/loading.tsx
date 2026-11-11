export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-lg space-y-3">
      <div className="skel h-10 w-24 rounded-full" />
      <div className="skel h-44 rounded-3xl" />
      <div className="skel h-5 w-1/2 rounded-full" />
      <div className="skel h-3 w-full rounded-full" />
      <div className="skel h-56 rounded-3xl" />
      <div className="skel h-14 rounded-[14px]" />
    </div>
  );
}
