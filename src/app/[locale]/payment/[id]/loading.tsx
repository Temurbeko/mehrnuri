export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-md space-y-4">
      <div className="skel mx-auto h-20 w-20 rounded-full" />
      <div className="skel mx-auto h-6 w-2/3 rounded-full" />
      <div className="skel h-40 rounded-3xl" />
      <div className="skel h-14 rounded-[14px]" />
    </div>
  );
}
