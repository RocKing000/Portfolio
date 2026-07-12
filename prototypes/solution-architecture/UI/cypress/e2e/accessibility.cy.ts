import type { KbArticle } from '../../src/app/models/kb-article.model';

describe('Accessibility', () => {
  let articles: KbArticle[];

  before(() => {
    cy.fixture('articles').then((data: KbArticle[]) => { articles = data; });
  });

  // ─── Search Page ─────────────────────────────────────────────────────────────

  describe('Search page', () => {
    beforeEach(() => {
      cy.stubSearch(articles);
      cy.visit('/search');
    });

    it('has a single h1 heading', () => {
      cy.get('h1').should('have.length', 1);
    });

    it('search input has autofocus', () => {
      cy.get('.search-bar__input').should('have.focus');
    });

    it('search button has a type attribute', () => {
      cy.get('.search-bar__btn').should('have.attr', 'type');
    });

    it('toggle buttons have aria-expanded attribute', () => {
      cy.get('.search-bar__input').type('CIBIL');
      cy.wait('@searchRequest');
      cy.get('.toggle-btn').each(($btn) => {
        expect($btn).to.have.attr('aria-expanded');
      });
    });

    it('all images have alt text', () => {
      cy.get('img').each(($img) => {
        expect($img).to.have.attr('alt');
      });
    });

    it('search input is keyboard-navigable', () => {
      cy.get('.search-bar__input').focus().type('test').should('have.value', 'test');
    });

    it('can submit with keyboard Enter', () => {
      cy.get('.search-bar__input').type('CIBIL{enter}');
      cy.wait('@searchRequest');
      cy.get('.card').should('exist');
    });
  });

  // ─── Browse Page ─────────────────────────────────────────────────────────────

  describe('Browse page', () => {
    beforeEach(() => {
      cy.stubGetAll(articles);
      cy.visit('/browse');
      cy.wait('@getAllRequest');
    });

    it('has a single h1 heading', () => {
      cy.get('h1').should('have.length', 1);
    });

    it('article titles use h3', () => {
      cy.get('.card__title').each(($el) => {
        expect($el.prop('tagName')).to.equal('H3');
      });
    });

    it('toggle buttons have aria-expanded attribute', () => {
      cy.get('.toggle-btn').each(($btn) => {
        expect($btn).to.have.attr('aria-expanded');
      });
    });

    it('toggle buttons are keyboard-activatable', () => {
      cy.get('.toggle-btn').first().focus().type('{enter}');
      cy.get('.solution').should('be.visible');
    });
  });
});
