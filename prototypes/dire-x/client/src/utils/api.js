import axios from 'axios';
import { API_TIMEOUT_MS } from '../config';

const api = axios.create({
  baseURL: '/api',
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => {
    // Vercel SPA rewrite returns index.html (200) for unknown /api/* routes.
    // Detect and reject HTML responses so catch blocks use fallback data.
    if (typeof response.data === 'string' && response.data.trimStart().startsWith('<')) {
      return Promise.reject(new Error('API unavailable'));
    }
    return response;
  },
  (error) => {
    const message =
      error.response?.data?.error || error.response?.data?.message || error.message || 'An unexpected error occurred';
    console.error('[DIRE-X API Error]', { url: error.config?.url, status: error.response?.status, message });
    return Promise.reject(new Error(message));
  }
);

// Core
export const getCompanies = () => api.get('/companies').then(r => r.data);
export const getCompany = (id) => api.get(`/companies/${id}`).then(r => r.data);
export const getRisk = (id) => api.get(`/risk/${id}`).then(r => r.data);
export const submitSimulation = (payload) => api.post('/simulate', payload).then(r => r.data);
export const createCompanyAPI = (data) => api.post('/create-company', data).then(r => r.data);
export const getWorldState = () => api.get('/world-state').then(r => r.data);
export const getLeaderboard = () => api.get('/leaderboard').then(r => r.data);
export const worldTick = () => api.post('/world-state/tick').then(r => r.data);
export const triggerScenario = (type) => api.post('/world-state/trigger-scenario', { type }).then(r => r.data);

// Strategic
export const getStrategicActions = (companyId, metrics) =>
  api.get(`/strategic/${companyId}`, { params: metrics }).then(r => r.data);
export const createStrategicAction = (data) => api.post('/strategic', data).then(r => r.data);
export const processStrategicTick = (data) => api.post('/strategic/process', data).then(r => r.data);

// Economy
export const getMarketState = () => api.get('/economy/market').then(r => r.data);
export const calculateEconomics = (data) => api.post('/economy/calculate', data).then(r => r.data);
export const economyTick = (data) => api.post('/economy/tick', data).then(r => r.data);

// Workforce
export const initWorkforce = (data) => api.post('/workforce/init', data).then(r => r.data);
export const getWorkforce = (companyId) => api.get(`/workforce/${companyId}`).then(r => r.data);
export const workforceTick = (data) => api.post('/workforce/tick', data).then(r => r.data);

// Ideas
export const submitIdea = (data) => api.post('/ideas', data).then(r => r.data);
export const getIdeas = (companyId) => api.get(`/ideas/${companyId}`).then(r => r.data);
export const getIdeaBadges = (companyId) => api.get(`/ideas/${companyId}/badges`).then(r => r.data);

// Geo
export const getCountries = () => api.get('/geo/countries').then(r => r.data);
export const getTradeRoutes = () => api.get('/geo/trade-routes').then(r => r.data);
export const getStraits = () => api.get('/geo/straits').then(r => r.data);
export const getResourceMap = (resource) => api.get(`/geo/resource-map/${encodeURIComponent(resource)}`).then(r => r.data);

// GDP
export const getGDPRanking = () => api.get('/gdp').then(r => r.data);
export const getCompanyGDPContribution = (companyId) => api.get(`/gdp/company/${companyId}`).then(r => r.data);

// Geopolitical
export const getCountryRelations = (country) => api.get(`/geopolitical/relations/${encodeURIComponent(country)}`).then(r => r.data);
export const getGeopoliticalSnapshot = () => api.get('/geopolitical/snapshot').then(r => r.data);

// Health / Literacy
export const getCountryHealth = (country) => api.get(`/health/${encodeURIComponent(country)}`).then(r => r.data);
export const getAllSocialIndicators = () => api.get('/health/all').then(r => r.data);

// Compliance
export const getComplianceProfile = (companyId) => api.get(`/compliance/${companyId}`).then(r => r.data);

// Population
export const getCountryPopulation = (country) =>
  api.get(`/health/population/${encodeURIComponent(country)}`).then(r => r.data);

// Government Budget
export const getGovernmentBudget = (country) =>
  api.get(`/health/budget/${encodeURIComponent(country)}`).then(r => r.data);

// Competition
export const getCompetitionData = (companyId, params) =>
  api.get(`/competition/${companyId}`, { params }).then(r => r.data);
export const getSectorCompetition = (industry) =>
  api.get(`/competition/sector/${encodeURIComponent(industry)}`).then(r => r.data);

// Countries (DB-backed — simulation reads from here, not live APIs)
export const getCountriesMaster = (params) =>
  api.get('/countries', { params }).then(r => r.data);
export const getCountryMaster = (iso3) =>
  api.get(`/countries/${iso3}`).then(r => r.data);
export const getGDPRankingDB = (limit = 50) =>
  api.get('/countries/ranking/gdp', { params: { limit } }).then(r => r.data);
export const getDataStatus = () =>
  api.get('/countries/status').then(r => r.data);

// Nations (derived from companies.country)
export const getNations = () =>
  api.get('/nations').then(r => r.data);

// Companies filtered by nation (ISO2 code)
export const getCompaniesByNation = (nationCode) =>
  api.get('/companies', { params: { nationId: nationCode } }).then(r => r.data);

// Strategic resources (all, or filtered by company)
export const getAllResources = () =>
  api.get('/strategic-resources').then(r => r.data);
export const getResourcesByCompany = (companyId) =>
  api.get('/strategic-resources', { params: { companyId } }).then(r => r.data);

// Risk heatmap (nation-level AI-scored risk)
export const getRiskHeatmap = (params = {}) =>
  api.get('/risk/heatmap', { params }).then(r => r.data);

// AI insights
export const getAIInsight = (params) =>
  api.get('/ai/insight', { params }).then(r => r.data);

export default api;
