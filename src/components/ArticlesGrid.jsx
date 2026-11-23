import { ARTICLES_ITEMS } from "../config/home";
import ArticleCard from "./ArticleCard";

export default function ArticlesGrid({ articles = ARTICLES_ITEMS }) {
  return (
    <section class="articles-section home-section" aria-labelledby="articles-title">
      <div class="home-shell">
        <header class="articles-section__header">
          <h2 id="articles-title">Artículos</h2>
          <a href="/papeles-y-tratados">Papeles y tratados <span aria-hidden="true">↗</span></a>
        </header>

        <div class="articles-grid article-deck">
          {articles.map((article) => <ArticleCard article={article} key={article.slug || article.title} />)}
        </div>
      </div>

      <style>{`
        .articles-section {
          overflow: clip;
          color: #17181a;
          background: #dfe3e4;
        }

        .articles-section__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1.5rem;
          padding-inline: clamp(0.5rem, 3vw, 3rem);
        }

        .articles-section__header h2 {
          margin: 0;
          font-family: var(--font-body);
          font-size: clamp(3rem, 5.5vw, 5.5rem);
          font-weight: 700;
          line-height: 0.95;
          letter-spacing: -0.045em;
        }

        .articles-section__header a {
          color: inherit;
          font-size: 0.8rem;
          text-underline-offset: 5px;
        }

        .articles-section__header a:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 5px;
        }

        @media (max-width: 600px) {
          .articles-section__header {
            align-items: start;
            flex-direction: column;
            gap: 1rem;
          }
        }
      `}</style>
    </section>
  );
}
