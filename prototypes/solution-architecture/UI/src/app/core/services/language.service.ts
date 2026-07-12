import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Language = 'en' | 'kn';

const STORAGE_KEY = 'sarge_language';

const TRANSLATIONS: Record<string, Record<Language, string>> = {

  // ── Search page hero ──────────────────────────────────────────────────────
  search_placeholder: {
    en: 'Search by error code, message, or description',
    kn: 'ದೋಷ ಕೋಡ್, ಸಂದೇಶ ಅಥವಾ ವಿವರಣೆಯಿಂದ ಹುಡುಕಿ',
  },
  knowledge_base: {
    en: 'Knowledge Base',
    kn: 'ಜ್ಞಾನ ಭಂಡಾರ',
  },
  hero_subtitle: {
    en: 'Search Scenarios',
    kn: 'ಸನ್ನಿವೇಶಗಳನ್ನು ಹುಡುಕಿ',
  },

  // ── Quick filter chips ────────────────────────────────────────────────────
  filter_common:   { en: 'Common:',   kn: 'ಸಾಮಾನ್ಯ:' },
  chip_k100:       { en: 'K-100',     kn: 'K-100' },
  chip_cibil:      { en: 'CIBIL',     kn: 'CIBIL' },
  chip_kyc:        { en: 'KYC',       kn: 'KYC' },
  chip_enach:      { en: 'ENACH',     kn: 'ENACH' },
  chip_frozen:     { en: 'Frozen',    kn: 'ಫ್ರೋಜನ್' },
  chip_biometric:  { en: 'Biometric', kn: 'ಬಯೋಮೆಟ್ರಿಕ್' },

  // ── Relevance / match type badges ────────────────────────────────────────
  match_exact:   { en: 'Exact match',   kn: 'ನಿಖರ ಹೊಂದಾಣಿಕೆ' },
  match_good:    { en: 'Good match',    kn: 'ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ' },
  match_partial: { en: 'Partial match', kn: 'ಭಾಗಶಃ ಹೊಂದಾಣಿಕೆ' },

  // ── Loading states ────────────────────────────────────────────────────────
  loading_ai_model: {
    en: 'Loading AI model… (first search may take up to 30 seconds)',
    kn: 'AI ಮಾದರಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ… (ಮೊದಲ ಹುಡುಕಾಟಕ್ಕೆ 30 ಸೆಕೆಂಡ್ ತನಕ ತಗಲಬಹುದು)',
  },
  loading_knowledge_base: {
    en: 'Searching knowledge base…',
    kn: 'ಜ್ಞಾನ ಭಂಡಾರ ಹುಡುಕಲಾಗುತ್ತಿದೆ…',
  },
  loading_ai_hint: {
    en: 'AI model warming up. Subsequent searches will be instant.',
    kn: 'AI ಮಾದರಿ ಸಿದ್ಧವಾಗುತ್ತಿದೆ. ಮುಂದಿನ ಹುಡುಕಾಟಗಳು ತಕ್ಷಣ ಆಗುತ್ತವೆ.',
  },

  // ── Results meta ──────────────────────────────────────────────────────────
  results_found: {
    en: 'results found',
    kn: 'ಫಲಿತಾಂಶಗಳು ಸಿಕ್ಕಿವೆ',
  },

  // ── Result card sections ──────────────────────────────────────────────────
  problem_description: { en: 'Problem Description', kn: 'ಸಮಸ್ಯೆ ವಿವರಣೆ' },
  solution_steps:      { en: 'Solution Steps',      kn: 'ಪರಿಹಾರ ಹಂತಗಳು' },
  copy_steps_tooltip:  { en: 'Copy all steps',      kn: 'ಎಲ್ಲಾ ಹಂತಗಳನ್ನು ನಕಲಿಸಿ' },
  btn_copy:            { en: 'Copy',                kn: 'ನಕಲಿಸಿ' },
  prerequisites:       { en: 'Prerequisites',       kn: 'ಪೂರ್ವಾಪೇಕ್ಷಿತಗಳು' },
  expected_outcome:    { en: 'Expected Outcome',    kn: 'ನಿರೀಕ್ಷಿತ ಫಲಿತಾಂಶ' },
  escalation_notes:    { en: 'Escalation Notes',   kn: 'ಉನ್ನತೀಕರಣ ಟಿಪ್ಪಣಿಗಳು' },

  // ── Feedback ──────────────────────────────────────────────────────────────
  was_helpful:        { en: 'Was this helpful?',  kn: 'ಇದು ಸಹಾಯಕವಾಗಿತ್ತೇ?' },
  feedback_submitted: { en: 'Feedback submitted', kn: 'ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಲಾಗಿದೆ' },
  btn_helpful:        { en: 'Helpful',            kn: 'ಸಹಾಯಕ' },
  btn_not_helpful:    { en: 'Not Helpful',        kn: 'ಸಹಾಯಕ ಅಲ್ಲ' },

  // ── Empty / no-results states ─────────────────────────────────────────────
  no_results_title: {
    en: 'No results found',
    kn: 'ಯಾವುದೇ ಫಲಿತಾಂಶ ಸಿಗಲಿಲ್ಲ',
  },
  no_match_prefix: { en: 'No match for',                            kn: 'ಇದಕ್ಕೆ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲ' },
  try_different:   { en: 'Try different keywords or an error code.', kn: 'ವಿಭಿನ್ನ ಕೀವರ್ಡ್ ಅಥವಾ ದೋಷ ಕೋಡ್ ಪ್ರಯತ್ನಿಸಿ.' },
  hint_title: {
    en: 'Search the knowledge base',
    kn: 'ಜ್ಞಾನ ಭಂಡಾರ ಹುಡುಕಿ',
  },
  hint_msg: {
    en: 'Enter error code, message, or keyword',
    kn: 'ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳನ್ನು ನಮೂದಿಸಿ: ದೋಷ ಕೋಡ್, ಸಂದೇಶ ಅಥವಾ ಕೀವರ್ಡ್',
  },
  kannada_hint: {
    en: 'Typing in Kannada? The search understands it.',
    kn: 'ಕನ್ನಡದಲ್ಲಿ ಟೈಪ್ ಮಾಡುತ್ತಿದ್ದೀರಾ? ಹುಡುಕಾಟ ಅದನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ.',
  },

  // ── Navigation / route names ──────────────────────────────────────────────
  route_knowledge_base: { en: 'Knowledge Base', kn: 'ಜ್ಞಾನ ಭಂಡಾರ' },
  route_signals:        { en: 'Signals',        kn: 'ಸಂಕೇತಗಳು' },
  route_analytics:      { en: 'Analytics',      kn: 'ವಿಶ್ಲೇಷಣೆ' },
  route_dashboard:      { en: 'Dashboard',      kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  route_faq:            { en: 'FAQ',            kn: 'ಪ್ರಶ್ನೋತ್ತರ' },
  route_admin:          { en: 'Admin',          kn: 'ನಿರ್ವಹಣೆ' },

  // ── Chatbot ───────────────────────────────────────────────────────────────
  chat_title:           { en: 'SARGE Assistant',    kn: 'SARGE ಸಹಾಯಕ' },
  chat_online:          { en: '● Online',            kn: '● ಆನ್‌ಲೈನ್' },
  chat_clear:           { en: 'Clear chat',          kn: 'ಚಾಟ್ ತೆರವುಗೊಳಿಸಿ' },
  chat_placeholder:     { en: 'Ask me anything...',  kn: 'ಏನು ಬೇಕಾದರೂ ಕೇಳಿ...' },
  chat_quick_dashboard: { en: 'Dashboard',           kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },

  // ── App-level ─────────────────────────────────────────────────────────────
  app_title: {
    en: 'FedMithra - Error Resolution Platform',
    kn: 'ಫೆಡ್ಮಿತ್ರಾ - ದೋಷ ಪರಿಹಾರ ವೇದಿಕೆ',
  },
  app_tagline: {
    en: 'Intelligent Error Detection and Resolution',
    kn: 'ಬುದ್ಧಿವಂತ ದೋಷ ಪತ್ತೆ ಮತ್ತು ಪರಿಹಾರ',
  },

  // ── Navigation (extended) ─────────────────────────────────────────────────
  nav_knowledge_base: { en: 'Knowledge Base',  kn: 'ಜ್ಞಾನ ಭಂಡಾರ' },
  nav_signals:        { en: 'Signals',         kn: 'ಸಂಕೇತಗಳು' },
  nav_analytics:      { en: 'Analytics',       kn: 'ವಿಶ್ಲೇಷಣೆ' },
  nav_dashboard:      { en: 'Dashboard',       kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  nav_faq:            { en: 'FAQ',             kn: 'ಪ್ರಶ್ನೋತ್ತರ' },
  nav_admin:          { en: 'Administration',  kn: 'ನಿರ್ವಹಣೆ' },
  nav_logout:         { en: 'Logout',          kn: 'ಲಾಗ್ ಔಟ್' },
  nav_navigation:     { en: 'Navigation',      kn: 'ನ್ಯಾವಿಗೇಶನ್' },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth_login:           { en: 'Login',                            kn: 'ಲಾಗಿನ್' },
  auth_username:        { en: 'Username',                         kn: 'ಬಳಕೆದಾರ ಹೆಸರು' },
  auth_password:        { en: 'Password',                         kn: 'ಪಾಸ್‌ವರ್ಡ್' },
  auth_login_button:    { en: 'Sign In',                          kn: 'ಸೈನ್ ಇನ್' },
  auth_login_error:     { en: 'Invalid username or password',     kn: 'ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ' },
  auth_remember_me:     { en: 'Remember me',                      kn: 'ನನ್ನನ್ನು ನೆನಪಿಡಿ' },
  auth_forgot_password: { en: 'Forgot password?',                 kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿದ್ದೀರಾ?' },
  auth_show_password:   { en: 'Show password',                    kn: 'ಪಾಸ್‌ವರ್ಡ್ ತೋರಿಸಿ' },
  auth_hide_password:   { en: 'Hide password',                    kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆಮಾಡಿ' },
  auth_signing_in:      { en: 'Signing in...',                    kn: 'ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ...' },
  auth_tagline:         { en: 'Real-Time Error Resolution Platform', kn: 'ರಿಯಲ್-ಟೈಮ್ ದೋಷ ಪರಿಹಾರ ವೇದಿಕೆ' },
  auth_brand:           { en: 'SARGE',                            kn: 'SARGE' },
  auth_version:         { en: 'Version 2.0',                      kn: 'ಆವೃತ್ತಿ 2.0' },

  // ── Common action buttons ─────────────────────────────────────────────────
  btn_save:      { en: 'Save',     kn: 'ಉಳಿಸಿ' },
  btn_cancel:    { en: 'Cancel',   kn: 'ರದ್ದುಗೊಳಿಸಿ' },
  btn_delete:    { en: 'Delete',   kn: 'ಅಳಿಸಿ' },
  btn_edit:      { en: 'Edit',     kn: 'ಸಂಪಾದಿಸಿ' },
  btn_create:    { en: 'Create',   kn: 'ರಚಿಸಿ' },
  btn_search:    { en: 'Search',   kn: 'ಹುಡುಕಿ' },
  btn_filter:    { en: 'Filter',   kn: 'ಫಿಲ್ಟರ್' },
  btn_export:    { en: 'Export',   kn: 'ರಫ್ತು' },
  btn_refresh:   { en: 'Refresh',  kn: 'ರಿಫ್ರೆಶ್' },
  btn_close:     { en: 'Close',    kn: 'ಮುಚ್ಚಿ' },
  btn_yes:       { en: 'Yes',      kn: 'ಹೌದು' },
  btn_no:        { en: 'No',       kn: 'ಇಲ್ಲ' },
  btn_ok:        { en: 'OK',       kn: 'ಸರಿ' },
  btn_add:       { en: 'Add',      kn: 'ಸೇರಿಸಿ' },
  btn_view:      { en: 'View',     kn: 'ನೋಡಿ' },
  btn_back:      { en: 'Back',     kn: 'ಹಿಂದೆ' },
  btn_submit:    { en: 'Submit',   kn: 'ಸಲ್ಲಿಸಿ' },
  btn_clear:     { en: 'Clear',    kn: 'ತೆರವುಗೊಳಿಸಿ' },
  btn_assign:    { en: 'Assign',   kn: 'ನಿಯೋಜಿಸಿ' },
  btn_classify:  { en: 'Classify', kn: 'ವರ್ಗೀಕರಿಸಿ' },
  btn_share:     { en: 'Share',    kn: 'ಹಂಚಿಕೊಳ್ಳಿ' },
  btn_download:  { en: 'Download', kn: 'ಡೌನ್‌ಲೋಡ್' },

  // ── Signals ───────────────────────────────────────────────────────────────
  signals_title:          { en: 'Signal Management',             kn: 'ಸಂಕೇತ ನಿರ್ವಹಣೆ' },
  signals_create:         { en: 'Create Signal',                 kn: 'ಸಂಕೇತ ರಚಿಸಿ' },
  signals_count:          { en: 'signals',                       kn: 'ಸಂಕೇತಗಳು' },
  signals_critical_count: { en: 'critical',                      kn: 'ನಿರ್ಣಾಯಕ' },
  signals_open:           { en: 'Open',                          kn: 'ತೆರೆದ' },
  signals_in_progress:    { en: 'In Progress',                   kn: 'ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ' },
  signals_resolved:       { en: 'Resolved',                      kn: 'ಪರಿಹರಿಸಲಾಗಿದೆ' },
  signals_closed:         { en: 'Closed',                        kn: 'ಮುಚ್ಚಲಾಗಿದೆ' },
  signals_severity:       { en: 'Severity',                      kn: 'ತೀವ್ರತೆ' },
  signals_type:           { en: 'Type',                          kn: 'ಪ್ರಕಾರ' },
  signals_source:         { en: 'Source',                        kn: 'ಮೂಲ' },
  signals_title_col:      { en: 'Title',                         kn: 'ಶೀರ್ಷಿಕೆ' },
  signals_status:         { en: 'Status',                        kn: 'ಸ್ಥಿತಿ' },
  signals_created_at:     { en: 'Created At',                    kn: 'ರಚಿಸಿದ ಸಮಯ' },
  signals_assigned_to:    { en: 'Assigned To',                   kn: 'ನಿಯೋಜಿಸಿದ ವ್ಯಕ್ತಿ' },
  signals_actions:        { en: 'Actions',                       kn: 'ಕ್ರಿಯೆಗಳು' },
  signals_empty:          { en: 'No signals found',              kn: 'ಯಾವುದೇ ಸಂಕೇತ ಕಂಡುಬಂದಿಲ್ಲ' },
  signals_description:    { en: 'Description',                   kn: 'ವಿವರಣೆ' },
  signals_payload:        { en: 'Payload',                       kn: 'ಡೇಟಾ' },
  signals_resolution_notes: { en: 'Resolution Notes',           kn: 'ಪರಿಹಾರ ಟಿಪ್ಪಣಿಗಳು' },
  signals_timeline:       { en: 'Timeline',                      kn: 'ಸಮಯರೇಖೆ' },
  signals_ml_classification: { en: 'ML Classification',         kn: 'ML ವರ್ಗೀಕರಣ' },
  signals_severity_info:  { en: 'Info',                          kn: 'ಮಾಹಿತಿ' },
  signals_severity_warning: { en: 'Warning',                    kn: 'ಎಚ್ಚರಿಕೆ' },
  signals_severity_error: { en: 'Error',                         kn: 'ದೋಷ' },
  signals_severity_critical: { en: 'Critical',                  kn: 'ನಿರ್ಣಾಯಕ' },
  signals_all_types:      { en: 'All Types',                     kn: 'ಎಲ್ಲಾ ಪ್ರಕಾರಗಳು' },
  signals_all_status:     { en: 'All Status',                    kn: 'ಎಲ್ಲಾ ಸ್ಥಿತಿ' },
  signals_update_status:  { en: 'Update Status',                 kn: 'ಸ್ಥಿತಿ ನವೀಕರಿಸಿ' },
  signals_no_transitions: { en: 'No further transitions available', kn: 'ಮುಂದಿನ ಬದಲಾವಣೆ ಸಾಧ್ಯವಿಲ್ಲ' },
  signals_select_status:  { en: 'Select new status',             kn: 'ಹೊಸ ಸ್ಥಿತಿ ಆಯ್ಕೆಮಾಡಿ' },
  signals_comments:       { en: 'Comments',                      kn: 'ಅಭಿಪ್ರಾಯಗಳು' },
  signals_add_comment:    { en: 'Add Comment',                   kn: 'ಅಭಿಪ್ರಾಯ ಸೇರಿಸಿ' },
  signals_internal_only:  { en: 'Internal only',                 kn: 'ಆಂತರಿಕ ಮಾತ್ರ' },
  signals_no_comments:    { en: 'No comments yet',               kn: 'ಇನ್ನೂ ಅಭಿಪ್ರಾಯಗಳಿಲ್ಲ' },
  signals_priority:       { en: 'Priority',                      kn: 'ಆದ್ಯತೆ' },
  signals_select_assignee: { en: 'Select assignee',             kn: 'ನಿಯೋಜಿಸಬೇಕಾದ ವ್ಯಕ್ತಿ ಆಯ್ಕೆಮಾಡಿ' },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard_title:           { en: 'Dashboard Builder',                               kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ನಿರ್ಮಾಣ' },
  dashboard_create:          { en: 'Create Dashboard',                                kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ರಚಿಸಿ' },
  dashboard_add_widget:      { en: 'Add Widget',                                      kn: 'ವಿಜೆಟ್ ಸೇರಿಸಿ' },
  dashboard_widget_count:    { en: 'widgets',                                         kn: 'ವಿಜೆಟ್‌ಗಳು' },
  dashboard_empty:           { en: 'No widgets yet. Add a widget to get started.',    kn: 'ಇನ್ನೂ ವಿಜೆಟ್‌ಗಳಿಲ್ಲ. ಪ್ರಾರಂಭಿಸಲು ವಿಜೆಟ್ ಸೇರಿಸಿ.' },
  dashboard_widget_library:  { en: 'Widget Library',                                  kn: 'ವಿಜೆಟ್ ಭಂಡಾರ' },
  dashboard_all_categories:  { en: 'All',                                             kn: 'ಎಲ್ಲಾ' },
  dashboard_templates_empty: { en: 'No templates in this category',                  kn: 'ಈ ವರ್ಗದಲ್ಲಿ ಯಾವುದೇ ಟೆಂಪ್ಲೇಟ್ ಇಲ್ಲ' },
  dashboard_premium:         { en: 'Premium',                                         kn: 'ಪ್ರೀಮಿಯಂ' },
  dashboard_share:           { en: 'Share Dashboard',                                 kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಹಂಚಿಕೊಳ್ಳಿ' },

  // ── Analytics ─────────────────────────────────────────────────────────────
  analytics_title:           { en: 'Analytics Dashboard',   kn: 'ವಿಶ್ಲೇಷಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  analytics_total_searches:  { en: 'Total Searches',        kn: 'ಒಟ್ಟು ಹುಡುಕಾಟಗಳು' },
  analytics_errors_identified: { en: 'Errors Identified',  kn: 'ಗುರುತಿಸಿದ ದೋಷಗಳು' },
  analytics_avg_duration:    { en: 'Avg Search Duration',   kn: 'ಸರಾಸರಿ ಹುಡುಕಾಟ ಅವಧಿ' },
  analytics_top_error:       { en: 'Top Error Code',        kn: 'ಅಗ್ರ ದೋಷ ಕೋಡ್' },
  analytics_trending_errors: { en: 'Trending Errors',       kn: 'ಟ್ರೆಂಡಿಂಗ್ ದೋಷಗಳು' },
  analytics_error_code:      { en: 'Error Code',            kn: 'ದೋಷ ಕೋಡ್' },
  analytics_error_name:      { en: 'Error Name',            kn: 'ದೋಷ ಹೆಸರು' },
  analytics_searches:        { en: 'Searches',              kn: 'ಹುಡುಕಾಟಗಳು' },
  analytics_views:           { en: 'Views',                 kn: 'ವೀಕ್ಷಣೆಗಳು' },
  analytics_helpfulness:     { en: 'Helpfulness',           kn: 'ಸಹಾಯಕತೆ' },
  analytics_period_day:      { en: 'Day',                   kn: 'ದಿನ' },
  analytics_period_week:     { en: 'Week',                  kn: 'ವಾರ' },
  analytics_period_month:    { en: 'Month',                 kn: 'ತಿಂಗಳು' },
  analytics_from_date:       { en: 'From',                  kn: 'ಇಂದಿನಿಂದ' },
  analytics_to_date:         { en: 'To',                    kn: 'ವರೆಗೆ' },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin_title:         { en: 'System Administration', kn: 'ವ್ಯವಸ್ಥೆ ನಿರ್ವಹಣೆ' },
  admin_app_config:    { en: 'App Configuration',     kn: 'ಅಪ್ಲಿಕೇಶನ್ ಸಂರಚನೆ' },
  admin_ui_config:     { en: 'UI Configuration',      kn: 'UI ಸಂರಚನೆ' },
  admin_users:         { en: 'User Management',       kn: 'ಬಳಕೆದಾರ ನಿರ್ವಹಣೆ' },
  admin_tenants:       { en: 'Tenant Management',     kn: 'ಟೆನಂಟ್ ನಿರ್ವಹಣೆ' },
  admin_error_library: { en: 'Error Library',         kn: 'ದೋಷ ಭಂಡಾರ' },
  admin_audit_log:     { en: 'Audit Logs',            kn: 'ಲೆಕ್ಕಪರಿಶೋಧನೆ ದಾಖಲೆಗಳು' },

  // ── Status labels ─────────────────────────────────────────────────────────
  status_open:        { en: 'Open',        kn: 'ತೆರೆದ' },
  status_in_progress: { en: 'In Progress', kn: 'ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ' },
  status_resolved:    { en: 'Resolved',    kn: 'ಪರಿಹರಿಸಲಾಗಿದೆ' },
  status_closed:      { en: 'Closed',      kn: 'ಮುಚ್ಚಲಾಗಿದೆ' },

  // ── Severity labels ───────────────────────────────────────────────────────
  sev_info:     { en: 'Info',     kn: 'ಮಾಹಿತಿ' },
  sev_warning:  { en: 'Warning',  kn: 'ಎಚ್ಚರಿಕೆ' },
  sev_error:    { en: 'Error',    kn: 'ದೋಷ' },
  sev_critical: { en: 'Critical', kn: 'ನಿರ್ಣಾಯಕ' },

  // ── Error categories ──────────────────────────────────────────────────────
  cat_connectivity:    { en: 'Connectivity',  kn: 'ಸಂಪರ್ಕತೆ' },
  cat_cibil:           { en: 'CIBIL',         kn: 'CIBIL' },
  cat_ekyc:            { en: 'EKYC',          kn: 'EKYC' },
  cat_business:        { en: 'Business Data', kn: 'ವ್ಯಾಪಾರ ಮಾಹಿತಿ' },
  cat_compliance:      { en: 'Compliance',    kn: 'ಅನುಸರಣೆ' },
  cat_enach:           { en: 'E-NACH',        kn: 'E-NACH' },
  cat_system:          { en: 'System',        kn: 'ವ್ಯವಸ್ಥೆ' },
  cat_authentication:  { en: 'Authentication', kn: 'ದೃಢೀಕರಣ' },
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly _lang = signal<Language>(this._loadSaved());
  private readonly _lang$ = new BehaviorSubject<Language>(this._lang());

  readonly current   = this._lang.asReadonly();
  readonly isKannada = computed(() => this._lang() === 'kn');
  readonly lang$     = this._lang$.asObservable();

  setLanguage(lang: Language): void {
    this._lang.set(lang);
    this._lang$.next(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }

  toggle(): void {
    this.setLanguage(this._lang() === 'en' ? 'kn' : 'en');
  }

  t(key: string): string {
    return TRANSLATIONS[key]?.[this._lang()] ?? key;
  }

  private _loadSaved(): Language {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved === 'en' || saved === 'kn') return saved;
    // Browser language detection as fallback
    const nav = navigator.language || (navigator.languages?.[0] ?? 'en');
    return nav.startsWith('kn') ? 'kn' : 'en';
  }
}
