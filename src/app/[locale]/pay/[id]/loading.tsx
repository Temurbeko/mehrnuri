export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-md space-y-3">
      <div className="skel h-10 w-24 rounded-full" />
      <div className="skel h-36 rounded-3xl" />
      <div className="skel h-14 rounded-[14px]" />
      <div className="skel h-14 rounded-[14px]" />
      <div className="skel h-14 rounded-[14px]" />
    </div>
  );
}
