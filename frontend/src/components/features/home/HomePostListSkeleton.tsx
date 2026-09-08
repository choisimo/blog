/** Mirrors the editorial row layout while post metadata is loading. */
export function HomePostListSkeleton({
  lead = false,
  count = 3,
}: {
  lead?: boolean;
  count?: number;
}) {
  return (
    <div className='ui-home-skeleton' aria-hidden='true'>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`ui-home-skeleton__row${lead && index === 0 ? ' ui-home-skeleton__row--lead' : ''}`}
        >
          <div className='ui-home-skeleton__meta' />
          <div className='ui-home-skeleton__title' />
          <div className='ui-home-skeleton__description' />
        </div>
      ))}
    </div>
  );
}
