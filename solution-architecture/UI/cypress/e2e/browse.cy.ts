import type { KbArticle } from '../../src/app/models/kb-article.model';

describe('Browse Page', () => {
  let articles: KbArticle[];

  before(() => {
    cy.fixture('articles').then((data: KbArticle[]) => { articles = data; });
  });

  // ─── Successful Load ─────────────────────────────────────────────────────────

  describe('with articles', () => {
    beforeEach(() => {
      cy.stubGetAll(articles);
      cy.visit('/browse');
      cy.wait('@getAllRequest');
    });

    it('renders the page title', () => {
      cy.get('.page-title').should('be.visible').and('contain', 'Browse All Articles');
    });

    it('groups articles under category headers', () => {
      cy.get('.category__header').should('have.length', 3); // Credit, Network, Documents
    });

    it('shows category badges', () => {
      cy.get('.category__header .badge--cat').should('have.length', 3);
      cy.get('.category__header .badge--cat').first().should('contain', 'Credit');
    });

    it('shows article count per category', () => {
      cy.get('.category__count').first().should('contain', '1 article');
    });

    it('renders all article cards', () => {
      cy.get('.card').should('have.length', 3);
    });

    it('shows article titles and descriptions', () => {
      cy.get('.card__title').should('contain', 'CIBIL Score Low');
      cy.get('.card__problem').first().should('not.be.empty');
    });

    it('shows issue code badges where present', () => {
      cy.get('.badge--code').should('have.length.at.least', 1);
    });

    it('does not show loading or error states', () => {
      cy.get('.state-msg').should('not.exist');
      cy.get('.alert').should('not.exist');
    });
  });

  // ─── Expand / Collapse ───────────────────────────────────────────────────────

  describe('article expand/collapse', () => {
    beforeEach(() => {
      cy.stubGetAll(articles);
      cy.visit('/browse');
      cy.wait('@getAllRequest');
    });

    it('solution steps hidden by default', () => {
      cy.get('.solution').should('not.exist');
    });

    it('expands solution steps on toggle click', () => {
      cy.get('.toggle-btn').first().click();
      cy.get('.solution').should('be.visible');
      cy.get('.steps__item').should('have.length.at.least', 1);
    });

    it('collapses on second click', () => {
      cy.get('.toggle-btn').first().click();
      cy.get('.solution').should('be.visible');
      cy.get('.toggle-btn').first().click();
      cy.get('.solution').should('not.exist');
    });

    it('only expands clicked article, leaves others collapsed', () => {
      cy.get('.toggle-btn').first().click();
      cy.get('.solution').should('have.length', 1);
    });

    it('sets aria-expanded correctly', () => {
      cy.get('.toggle-btn').first().should('have.attr', 'aria-expanded', 'false');
      cy.get('.toggle-btn').first().click();
      cy.get('.toggle-btn').first().should('have.attr', 'aria-expanded', 'true');
    });
  });

  // ─── Empty State ─────────────────────────────────────────────────────────────

  describe('with no articles', () => {
    beforeEach(() => {
      cy.stubGetAll([]);
      cy.visit('/browse');
      cy.wait('@getAllRequest');
    });

    it('shows empty state message', () => {
      cy.get('.state-msg').should('be.visible').and('contain', 'No articles');
    });

    it('does not render any cards', () => {
      cy.get('.card').should('not.exist');
    });
  });

  // ─── Error State ─────────────────────────────────────────────────────────────

  describe('on API error', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/kb/articles', { statusCode: 500, body: 'Server Error' }).as('failedGet');
      cy.visit('/browse');
      cy.wait('@failedGet');
    });

    it('shows error alert', () => {
      cy.get('.alert').should('be.visible').and('contain', 'Failed to load');
    });

    it('does not show the loading state', () => {
      cy.get('.state-msg').should('not.exist');
    });
  });

  // ─── Loading State ───────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading message while fetching', () => {
      cy.intercept('GET', '**/kb/articles', (req) => {
        req.reply({ delay: 1000, body: articles });
      }).as('slowGet');

      cy.visit('/browse');
      cy.get('.state-msg').should('contain', 'Loading');
      cy.wait('@slowGet');
    });
  });
});
