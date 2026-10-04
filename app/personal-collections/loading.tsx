import "./public-collections.css";

export default function PublicCollectionsLoading() {
  return <main className="public-collections-loading" aria-busy="true" aria-live="polite">
    <span className="sr-only">正在加载公开收藏馆</span>
    <div className="public-collections-loading-header">
      <div className="public-collections-skeleton skeleton-mark" />
      <div className="public-collections-skeleton skeleton-nav" />
      <div className="public-collections-skeleton skeleton-account" />
    </div>
    <section className="public-collections-loading-intro">
      <div>
        <div className="public-collections-skeleton skeleton-kicker" />
        <div className="public-collections-skeleton skeleton-title" />
        <div className="public-collections-skeleton skeleton-copy" />
      </div>
      <div className="public-collections-skeleton skeleton-search" />
    </section>
    <section className="public-collections-loading-results">
      <div className="public-collections-skeleton skeleton-section-title" />
      <div className="public-collections-loading-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="public-collections-loading-card" key={index}>
          <div className="public-collections-skeleton skeleton-card-image" />
          <div className="public-collections-skeleton skeleton-card-heading" />
          <div className="public-collections-skeleton skeleton-card-line" />
          <div className="public-collections-skeleton skeleton-card-line short" />
        </div>)}
      </div>
    </section>
  </main>;
}
