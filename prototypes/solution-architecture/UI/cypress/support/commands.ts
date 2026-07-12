import { KbArticle } from '../../src/app/models/kb-article.model';

// Stub the search API and return given articles
Cypress.Commands.add('stubSearch', (articles: KbArticle[]) => {
  cy.intercept('GET', '**/kb/articles/search*', { body: articles }).as('searchRequest');
});

// Stub the getAll API
Cypress.Commands.add('stubGetAll', (articles: KbArticle[]) => {
  cy.intercept('GET', '**/kb/articles', { body: articles }).as('getAllRequest');
});

declare global {
  namespace Cypress {
    interface Chainable {
      stubSearch(articles: KbArticle[]): Chainable<void>;
      stubGetAll(articles: KbArticle[]): Chainable<void>;
    }
  }
}
