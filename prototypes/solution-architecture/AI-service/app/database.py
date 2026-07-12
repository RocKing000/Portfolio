import pymssql
import json
from typing import List, Dict, Any, Optional, Tuple
from app.config import get_settings
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
settings = get_settings()

class Database:
    @staticmethod
    def get_connection():
        try:
            return pymssql.connect(
                server=settings.db_server,
                user=settings.db_user,
                password=settings.db_password,
                database=settings.db_name,
                port=settings.db_port,
                timeout=10
            )
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    # =========================================================================
    # EXISTING FUNCTIONS (ENHANCED)
    # =========================================================================

    @staticmethod
    def load_all_errors(tenant_code: str) -> List[Dict[str, Any]]:
        """Load all active errors with ML metrics"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = """
                SELECT DISTINCT
                    CONVERT(VARCHAR(50), e.error_id) as error_id,
                    e.error_code,
                    e.error_title,
                    e.error_description,
                    e.solution,
                    e.root_cause,
                    e.severity,
                    e.category,
                    h.node_name as module_name,
                    hp.node_name as product_name,
                    e.auto_keywords,
                    ISNULL(e.search_impressions, 0) as search_impressions,
                    ISNULL(e.search_clicks, 0) as search_clicks,
                    ISNULL(e.click_through_rate, 0.0) as click_through_rate,
                    e.avg_result_position,
                    e.embedding_vector,
                    e.last_embedding_update,
                    CONCAT(
                        e.error_title, ' ',
                        ISNULL(e.error_description, ''), ' ',
                        ISNULL(e.solution, ''), ' ',
                        ISNULL(e.root_cause, ''), ' ',
                        ISNULL(e.category, ''), ' ',
                        ISNULL(h.node_name, ''), ' ',
                        ISNULL(hp.node_name, '')
                    ) as search_text
                FROM kb.error_library e
                LEFT JOIN kb.error_hierarchy h
                    ON e.error_id = h.error_id AND h.node_type = 'ERROR'
                LEFT JOIN kb.error_hierarchy hp
                    ON h.parent_node_id = hp.node_id AND hp.node_type = 'MODULE'
                WHERE e.is_active = 1
                ORDER BY e.error_code
            """

            cursor.execute(query)
            errors = cursor.fetchall()

            # Parse JSON fields
            for error in errors:
                if error.get('auto_keywords'):
                    try:
                        error['auto_keywords'] = json.loads(error['auto_keywords'])
                    except:
                        error['auto_keywords'] = None

            logger.info(f"Loaded {len(errors)} errors from database for tenant {tenant_code}")
            return errors

        except Exception as e:
            logger.error(f"Error loading from database: {e}")
            raise
        finally:
            if conn:
                conn.close()

    @staticmethod
    def test_connection() -> bool:
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            return True
        except:
            return False

    # =========================================================================
    # SEARCH LOGGING FUNCTIONS
    # =========================================================================

    @staticmethod
    def log_search(
        query_text: str,
        tenant_code: str,
        selected_error_id: Optional[str] = None,
        result_position: Optional[int] = None,
        search_method: str = "HYBRID",
        total_results: int = 0,
        processing_time_ms: Optional[float] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Optional[int]:
        """Log a search query and update error metrics"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            # Call stored procedure to log search
            cursor.callproc('kb.sp_log_search', (
                query_text,
                tenant_code,
                selected_error_id,
                result_position,
                search_method,
                total_results,
                processing_time_ms,
                user_id,
                session_id
            ))

            conn.commit()

            # Get the log_id
            cursor.execute("SELECT @@IDENTITY as log_id")
            result = cursor.fetchone()
            log_id = result[0] if result else None

            logger.info(f"Logged search: query='{query_text}', method={search_method}, log_id={log_id}")
            return log_id

        except Exception as e:
            logger.error(f"Error logging search: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if conn:
                conn.close()

    @staticmethod
    def update_error_impressions(error_ids: List[str]) -> int:
        """Increment search_impressions for errors that appeared in results"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            if not error_ids:
                return 0

            # Convert list to comma-separated string for IN clause
            ids_str = "','".join(error_ids)

            query = f"""
                UPDATE kb.error_library
                SET search_impressions = search_impressions + 1
                WHERE CONVERT(VARCHAR(50), error_id) IN ('{ids_str}')
            """

            cursor.execute(query)
            rows_affected = cursor.rowcount
            conn.commit()

            logger.info(f"Updated impressions for {rows_affected} errors")
            return rows_affected

        except Exception as e:
            logger.error(f"Error updating impressions: {e}")
            if conn:
                conn.rollback()
            return 0
        finally:
            if conn:
                conn.close()

    # =========================================================================
    # EMBEDDING FUNCTIONS
    # =========================================================================

    @staticmethod
    def save_embedding(error_id: str, embedding_vector: bytes) -> bool:
        """Save precomputed embedding for an error"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            cursor.callproc('kb.sp_save_embedding', (error_id, embedding_vector))
            conn.commit()

            logger.info(f"Saved embedding for error_id={error_id}")
            return True

        except Exception as e:
            logger.error(f"Error saving embedding: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()

    @staticmethod
    def save_embeddings_batch(embeddings: List[Tuple[str, bytes]]) -> Dict[str, int]:
        """Save multiple embeddings in a batch"""
        conn = None
        success_count = 0
        failed_count = 0

        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            for error_id, embedding_vector in embeddings:
                try:
                    cursor.callproc('kb.sp_save_embedding', (error_id, embedding_vector))
                    success_count += 1
                except Exception as e:
                    logger.error(f"Failed to save embedding for {error_id}: {e}")
                    failed_count += 1

            conn.commit()
            logger.info(f"Batch saved embeddings: {success_count} success, {failed_count} failed")

            return {"success": success_count, "failed": failed_count}

        except Exception as e:
            logger.error(f"Error in batch save embeddings: {e}")
            if conn:
                conn.rollback()
            return {"success": success_count, "failed": failed_count}
        finally:
            if conn:
                conn.close()

    @staticmethod
    def load_embeddings() -> Dict[str, bytes]:
        """Load all precomputed embeddings"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = """
                SELECT
                    CONVERT(VARCHAR(50), error_id) as error_id,
                    embedding_vector
                FROM kb.error_library
                WHERE is_active = 1
                AND embedding_vector IS NOT NULL
            """

            cursor.execute(query)
            results = cursor.fetchall()

            embeddings = {
                row['error_id']: row['embedding_vector']
                for row in results
            }

            logger.info(f"Loaded {len(embeddings)} precomputed embeddings")
            return embeddings

        except Exception as e:
            logger.error(f"Error loading embeddings: {e}")
            return {}
        finally:
            if conn:
                conn.close()

    # =========================================================================
    # KEYWORD FUNCTIONS
    # =========================================================================

    @staticmethod
    def save_auto_keywords(error_id: str, keywords: List[Dict[str, Any]]) -> bool:
        """Save auto-extracted keywords for an error"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            # Save keywords as JSON in auto_keywords column
            keywords_json = json.dumps([kw['keyword'] for kw in keywords])

            query = """
                UPDATE kb.error_library
                SET auto_keywords = %s
                WHERE CONVERT(VARCHAR(50), error_id) = %s
            """

            cursor.execute(query, (keywords_json, error_id))

            # Insert into keywords table if they don't exist
            for kw in keywords:
                cursor.execute("""
                    IF NOT EXISTS (SELECT 1 FROM kb.keywords WHERE keyword_text = %s)
                    BEGIN
                        INSERT INTO kb.keywords (keyword_text, keyword_type, auto_generated, confidence_score, extraction_method)
                        VALUES (%s, 'RELATED', 1, %s, %s)
                    END
                """, (kw['keyword'], kw['keyword'], kw['confidence'], kw['method']))

            conn.commit()
            logger.info(f"Saved {len(keywords)} auto-keywords for error_id={error_id}")
            return True

        except Exception as e:
            logger.error(f"Error saving auto-keywords: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()

    @staticmethod
    def update_keyword_usage(keyword_text: str) -> bool:
        """Update usage count for a keyword"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            cursor.callproc('kb.sp_update_keyword_usage', (keyword_text,))
            conn.commit()

            return True

        except Exception as e:
            logger.error(f"Error updating keyword usage: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()

    # =========================================================================
    # ANALYTICS FUNCTIONS
    # =========================================================================

    @staticmethod
    def get_search_analytics(limit: int = 100) -> List[Dict[str, Any]]:
        """Get search analytics from view"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = f"""
                SELECT TOP {limit}
                    CONVERT(VARCHAR(50), error_id) as error_id,
                    error_code,
                    error_title,
                    severity,
                    category,
                    search_impressions,
                    search_clicks,
                    click_through_rate,
                    avg_result_position,
                    performance_category
                FROM kb.vw_search_analytics
                ORDER BY search_impressions DESC
            """

            cursor.execute(query)
            results = cursor.fetchall()

            return results

        except Exception as e:
            logger.error(f"Error getting search analytics: {e}")
            return []
        finally:
            if conn:
                conn.close()

    @staticmethod
    def get_top_queries(limit: int = 50, tenant_code: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get top searched queries"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            where_clause = f"WHERE tenant_code = '{tenant_code}'" if tenant_code else ""

            query = f"""
                SELECT TOP {limit}
                    query_text,
                    tenant_code,
                    query_count,
                    unique_sessions,
                    avg_processing_time,
                    avg_results,
                    click_count,
                    click_rate,
                    last_searched
                FROM kb.vw_top_queries
                {where_clause}
                ORDER BY query_count DESC
            """

            cursor.execute(query)
            results = cursor.fetchall()

            return results

        except Exception as e:
            logger.error(f"Error getting top queries: {e}")
            return []
        finally:
            if conn:
                conn.close()

    @staticmethod
    def get_top_queries_for_error(error_id: str, limit: int = 10) -> List[str]:
        """Get common queries that lead to a specific error (for synonym discovery)"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = """
                SELECT TOP %d
                    query_text,
                    COUNT(*) as frequency
                FROM kb.search_logs
                WHERE CONVERT(VARCHAR(50), selected_error_id) = %s
                GROUP BY query_text
                ORDER BY frequency DESC
            """

            cursor.execute(query, (limit, error_id))
            results = cursor.fetchall()

            return [row['query_text'] for row in results]

        except Exception as e:
            logger.error(f"Error getting top queries for error: {e}")
            return []
        finally:
            if conn:
                conn.close()

    # =========================================================================
    # SYNONYM FUNCTIONS
    # =========================================================================

    @staticmethod
    def get_synonyms(primary_term: str) -> List[str]:
        """Get synonyms for a term"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = """
                SELECT synonym_term
                FROM kb.synonym_mappings
                WHERE primary_term = %s AND is_active = 1
                ORDER BY similarity_score DESC
            """

            cursor.execute(query, (primary_term.lower(),))
            results = cursor.fetchall()

            return [row['synonym_term'] for row in results]

        except Exception as e:
            logger.error(f"Error getting synonyms: {e}")
            return []
        finally:
            if conn:
                conn.close()

    @staticmethod
    def save_synonym(
        primary_term: str,
        synonym_term: str,
        similarity_score: float,
        auto_discovered: bool = True,
        discovery_method: str = "QUERY_LOG"
    ) -> bool:
        """Save a discovered synonym"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            query = """
                IF NOT EXISTS (
                    SELECT 1 FROM kb.synonym_mappings
                    WHERE primary_term = %s AND synonym_term = %s
                )
                BEGIN
                    INSERT INTO kb.synonym_mappings
                    (primary_term, synonym_term, similarity_score, auto_discovered, discovery_method)
                    VALUES (%s, %s, %s, %s, %s)
                END
            """

            cursor.execute(query, (
                primary_term.lower(), synonym_term.lower(),
                primary_term.lower(), synonym_term.lower(),
                similarity_score, auto_discovered, discovery_method
            ))

            conn.commit()
            return True

        except Exception as e:
            logger.error(f"Error saving synonym: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()

    # =========================================================================
    # TRAINING DATA FUNCTIONS
    # =========================================================================

    @staticmethod
    def save_training_data(
        query_text: str,
        correct_error_id: str,
        incorrect_error_ids: Optional[List[str]] = None,
        relevance_score: Optional[float] = None,
        data_source: str = "SEARCH_LOG"
    ) -> bool:
        """Save training data point"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor()

            incorrect_json = json.dumps(incorrect_error_ids) if incorrect_error_ids else None

            query = """
                INSERT INTO kb.training_data
                (query_text, correct_error_id, incorrect_error_ids, relevance_score, data_source)
                VALUES (%s, %s, %s, %s, %s)
            """

            cursor.execute(query, (
                query_text, correct_error_id, incorrect_json, relevance_score, data_source
            ))

            conn.commit()
            return True

        except Exception as e:
            logger.error(f"Error saving training data: {e}")
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()

    @staticmethod
    def get_training_data(
        limit: int = 1000,
        data_source: Optional[str] = None,
        since_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get training data for ML pipeline"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            where_clauses = []
            params = []

            if data_source:
                where_clauses.append("data_source = %s")
                params.append(data_source)

            if since_date:
                where_clauses.append("created_at >= %s")
                params.append(since_date)

            where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

            query = f"""
                SELECT TOP {limit}
                    query_text,
                    CONVERT(VARCHAR(50), correct_error_id) as correct_error_id,
                    incorrect_error_ids,
                    relevance_score,
                    data_source,
                    created_at
                FROM kb.training_data
                {where_sql}
                ORDER BY created_at DESC
            """

            cursor.execute(query, params)
            results = cursor.fetchall()

            # Parse JSON fields
            for row in results:
                if row.get('incorrect_error_ids'):
                    try:
                        row['incorrect_error_ids'] = json.loads(row['incorrect_error_ids'])
                    except:
                        row['incorrect_error_ids'] = None

            return results

        except Exception as e:
            logger.error(f"Error getting training data: {e}")
            return []
        finally:
            if conn:
                conn.close()

    # =========================================================================
    # MODEL VERSION FUNCTIONS
    # =========================================================================

    @staticmethod
    def get_active_model_version(model_type: str = "EMBEDDING") -> Optional[Dict[str, Any]]:
        """Get the active model version for a specific type"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = """
                SELECT
                    CONVERT(VARCHAR(50), version_id) as version_id,
                    version_name,
                    model_type,
                    model_identifier,
                    is_active,
                    deployment_date,
                    deprecated_date,
                    performance_metrics,
                    config_params
                FROM kb.model_versions
                WHERE model_type = %s AND is_active = 1
                ORDER BY deployment_date DESC
            """

            cursor.execute(query, (model_type,))
            result = cursor.fetchone()

            if result:
                # Parse JSON fields
                if result.get('performance_metrics'):
                    try:
                        result['performance_metrics'] = json.loads(result['performance_metrics'])
                    except:
                        result['performance_metrics'] = None

                if result.get('config_params'):
                    try:
                        result['config_params'] = json.loads(result['config_params'])
                    except:
                        result['config_params'] = None

            return result

        except Exception as e:
            logger.error(f"Error getting active model version: {e}")
            return None
        finally:
            if conn:
                conn.close()

    @staticmethod
    def get_all_model_versions() -> List[Dict[str, Any]]:
        """Get all model versions"""
        conn = None
        try:
            conn = Database.get_connection()
            cursor = conn.cursor(as_dict=True)

            query = """
                SELECT
                    CONVERT(VARCHAR(50), version_id) as version_id,
                    version_name,
                    model_type,
                    model_identifier,
                    is_active,
                    deployment_date,
                    deprecated_date,
                    performance_metrics,
                    config_params
                FROM kb.model_versions
                ORDER BY deployment_date DESC
            """

            cursor.execute(query)
            results = cursor.fetchall()

            # Parse JSON fields
            for row in results:
                if row.get('performance_metrics'):
                    try:
                        row['performance_metrics'] = json.loads(row['performance_metrics'])
                    except:
                        row['performance_metrics'] = None

                if row.get('config_params'):
                    try:
                        row['config_params'] = json.loads(row['config_params'])
                    except:
                        row['config_params'] = None

            return results

        except Exception as e:
            logger.error(f"Error getting model versions: {e}")
            return []
        finally:
            if conn:
                conn.close()
