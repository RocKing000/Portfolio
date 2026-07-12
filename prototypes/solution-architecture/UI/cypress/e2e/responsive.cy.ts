import type { KbArticle } from '../../src/app/models/kb-article.model';

const viewports = [
  { name: 'Mobile Portrait', width: 375, height: 667 },
  { name: 'Mobile Landscape', width: 667, height: 375 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Desktop', width: 1366, height: 768 },
  { name: 'Full HD', width: 1920, height: 1080 }
] as const;

describe('Responsive Design', () => {
  let articles: KbArticle[];

  before(() => {
    cy.fixture('articles').then((data: KbArticle[]) => { articles = data; });
  });

  viewports.forEach(({ name, width, height }) => {
    describe(name, () => {
      beforeEach(() => {
        cy.viewport(width, height);
      });

      it(`search page renders without horizontal overflow at ${width}x${height}`, () => {
        cy.stubSearch(articles);
        cy.visit('/search');

        // No horizontal scrollbar
        cy.document().then((doc) => {
          expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
        });

        cy.get('.hero__title').should('be.visible');
        cy.get('.search-bar__input').should('be.visible');
        cy.get('.search-bar__btn').should('be.visible');
      });

      it(`browse page renders without horizontal overflow at ${width}x${height}`, () => {
        cy.stubGetAll(articles);
        cy.visit('/browse');
        cy.wait('@getAllRequest');

        cy.document().then((doc) => {
          expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
        });

        cy.get('.page-title').should('be.visible');
        cy.get('.card').should('have.length', articles.length);
      });

      it(`article cards are readable at ${width}x${height}`, () => {
        cy.stubSearch([articles[0]]);
        cy.visit('/search');
        cy.get('.search-bar__input').type('CIBIL');
        cy.wait('@searchRequest');

        cy.get('.card__title').should('be.visible');
        cy.get('.card__problem').should('be.visible');
        cy.get('.toggle-btn').should('be.visible');
      });

      it(`toggle button is tap-friendly at ${width}x${height}`, () => {
        cy.stubSearch([articles[0]]);
        cy.visit('/search');
        cy.get('.search-bar__input').type('CIBIL');
        cy.wait('@searchRequest');

        cy.get('.toggle-btn').then(($btn) => {
          const rect = $btn[0].getBoundingClientRect();
          // Minimum touch target: 44x44px
          expect(rect.height).to.be.gte(36);
          expect(rect.width).to.be.gte(36);
        });
      });
    });
  });

  // ─── Navigation ──────────────────────────────────────────────────────────────

  describe('Navigation links', () => {
    it('navigates from search to browse', () => {
      cy.stubGetAll(articles);
      cy.visit('/search');
      cy.get('a[href*="browse"]').click();
      cy.url().should('include', '/browse');
    });

    it('navigates from browse to search', () => {
      cy.stubGetAll(articles);
      cy.visit('/browse');
      cy.get('a[href*="search"]').click();
      cy.url().should('include', '/search');
    });

    it('redirects root path to /search', () => {
      cy.visit('/');
      cy.url().should('include', '/search');
    });

    it('redirects unknown paths to /search', () => {
      cy.visit('/nonexistent-page');
      cy.url().should('include', '/search');
    });
  });
});
