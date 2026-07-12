import type { KbArticle } from '../../src/app/models/kb-article.model';

describe('Search Page', () => {
  let articles: KbArticle[];

  before(() => {
    cy.fixture('articles').then((data: KbArticle[]) => { articles = data; });
  });

  beforeEach(() => {
    cy.visit('/search');
  });

  // ─── Layout & Initial State ──────────────────────────────────────────────────

  it('renders the hero section and search bar', () => {
    cy.get('.hero__title').should('be.visible').and('contain', 'Search Knowledge Base');
    cy.get('.search-bar__input').should('be.visible');
    cy.get('.search-bar__btn').should('be.visible').and('be.disabled');
  });

  it('has no results or empty state on initial load', () => {
    cy.get('.results').should('not.exist');
    cy.get('.empty').should('not.exist');
    cy.get('.alert').should('not.exist');
  });

  // ─── Search Interactions ─────────────────────────────────────────────────────

  it('enables the search button when text is entered', () => {
    cy.get('.search-bar__input').type('CIBIL');
    cy.get('.search-bar__btn').should('not.be.disabled');
  });

  it('shows results after typing with debounce', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('CIBIL');
    cy.wait('@searchRequest');
    cy.get('.card').should('have.length', 1);
    cy.get('.card__title').should('contain', 'CIBIL Score Low');
  });

  it('shows result count metadata', () => {
    cy.stubSearch(articles);
    cy.get('.search-bar__input').type('error');
    cy.wait('@searchRequest');
    cy.get('.results__meta').should('contain', `${articles.length} results`);
  });

  it('triggers search on Enter key press', () => {
    cy.stubSearch([articles[1]]);
    cy.get('.search-bar__input').type('connectivity{enter}');
    cy.wait('@searchRequest');
    cy.get('.card').should('have.length', 1);
  });

  it('triggers search on button click', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('CIBIL');
    cy.get('.search-bar__btn').click();
    cy.wait('@searchRequest');
    cy.get('.card').should('have.length', 1);
  });

  // ─── Empty & Error States ────────────────────────────────────────────────────

  it('shows empty state when no results found', () => {
    cy.stubSearch([]);
    cy.get('.search-bar__input').type('xyzunknown123');
    cy.wait('@searchRequest');
    cy.get('.empty').should('be.visible');
    cy.get('.empty').should('contain', 'No articles found');
  });

  it('shows error alert on API failure', () => {
    cy.intercept('GET', '**/kb/articles/search*', { statusCode: 500, body: 'Server Error' }).as('failedSearch');
    cy.get('.search-bar__input').type('error');
    cy.wait('@failedSearch');
    cy.get('.alert').should('be.visible').and('contain', 'Search failed');
  });

  it('shows loading spinner during search', () => {
    cy.intercept('GET', '**/kb/articles/search*', (req) => {
      req.reply({ delay: 800, body: [] });
    }).as('slowSearch');
    cy.get('.search-bar__input').type('slow');
    cy.get('.spinner').should('exist');
    cy.wait('@slowSearch');
  });

  // ─── Article Cards ───────────────────────────────────────────────────────────

  it('displays issue code badge when present', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('K-100');
    cy.wait('@searchRequest');
    cy.get('.badge--code').should('contain', 'K-100');
  });

  it('displays category badge', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('CIBIL');
    cy.wait('@searchRequest');
    cy.get('.badge--cat').should('contain', 'Credit');
  });

  it('expands solution steps on toggle click', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('CIBIL');
    cy.wait('@searchRequest');

    cy.get('.solution').should('not.exist');
    cy.get('.toggle-btn').click();
    cy.get('.solution').should('be.visible');
    cy.get('.steps__item').should('have.length.at.least', 1);
  });

  it('collapses solution steps on second click', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('CIBIL');
    cy.wait('@searchRequest');

    cy.get('.toggle-btn').click();
    cy.get('.solution').should('be.visible');
    cy.get('.toggle-btn').click();
    cy.get('.solution').should('not.exist');
  });

  it('sets correct aria-expanded on toggle button', () => {
    cy.stubSearch([articles[0]]);
    cy.get('.search-bar__input').type('CIBIL');
    cy.wait('@searchRequest');

    cy.get('.toggle-btn').should('have.attr', 'aria-expanded', 'false');
    cy.get('.toggle-btn').click();
    cy.get('.toggle-btn').should('have.attr', 'aria-expanded', 'true');
  });
});
