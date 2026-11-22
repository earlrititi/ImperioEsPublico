const ARTICLE_IMAGE_SIZES = "(max-width: 600px) 30vw, (max-width: 1000px) 32vw, 300px";

export default function ArticleCard({ article, headingLevel = "h3", searchText }) {
  const Heading = headingLevel;
  const Surface = article.href ? "a" : "div";

  return (
    <article
      class="article-card"
      data-paper-card={searchText !== undefined ? "" : undefined}
      data-category={searchText !== undefined ? article.category.toLowerCase() : undefined}
      data-search={searchText}
    >
      <Surface
        class="article-card__surface"
        href={article.href || undefined}
        aria-label={article.href ? `Abrir ${article.title}` : undefined}
      >
        <div class="article-card__header">
          <span>{article.category}</span>
          {article.href && <span class="article-card__arrow" aria-hidden="true">↗</span>}
        </div>

        <div class="article-card__body">
          <div class="article-card__copy">
            <Heading>{article.title}</Heading>
            {article.description && <p>{article.description}</p>}
          </div>

          <div class={`article-card__media${article.brandVariant ? " article-card__media--brand" : ""}`}>
            {article.imageAvifSrcSet ? (
              <picture>
                <source type="image/avif" srcSet={article.imageAvifSrcSet} sizes={ARTICLE_IMAGE_SIZES} />
                {article.imageWebpSrcSet && (
                  <source type="image/webp" srcSet={article.imageWebpSrcSet} sizes={ARTICLE_IMAGE_SIZES} />
                )}
                <img
                  src={article.imageSrc}
                  alt={article.imageAlt}
                  width={article.imageWidth}
                  height={article.imageHeight}
                  sizes={ARTICLE_IMAGE_SIZES}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            ) : (
              <img
                src={article.imageSrc}
                alt={article.imageAlt}
                width={article.imageWidth}
                height={article.imageHeight}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        </div>

        <div class="article-card__footer">
          <span>Imperio Español</span>
          {article.href && <span>Leer artículo</span>}
        </div>
      </Surface>
    </article>
  );
}
