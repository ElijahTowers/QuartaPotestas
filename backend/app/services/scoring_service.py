"""
Scoring service for calculating newspaper layout scores.
Pure Python math, NO LLM.
"""
from typing import Dict, Any, List


class ScoringService:
    """
    Calculates scores based on:
    - Base score per article
    - Layout multiplier (top vs bottom of page)
    - Faction modifiers (Elite/Populace/Gov)
    - Synergy checks (e.g., WAR article next to PEACE ad = hypocrisy penalty)
    """
    
    # Base scores
    BASE_SCORE_FACTUAL = 50
    BASE_SCORE_SENSATIONALIST = 75
    BASE_SCORE_PROPAGANDA = 60
    
    # Layout multipliers (row 0 = top, row 3 = bottom)
    LAYOUT_MULTIPLIERS = {
        0: 1.5,  # Top row - most visible
        1: 1.3,
        2: 1.1,
        3: 1.0,  # Bottom row
    }
    
    # Faction modifiers based on variant
    FACTION_MODIFIERS = {
        "factual": {
            "elite": 0.3,
            "populace": 0.5,
            "gov": 0.2,
        },
        "sensationalist": {
            "elite": 0.2,
            "populace": 0.7,
            "gov": 0.1,
        },
        "propaganda": {
            "elite": 0.1,
            "populace": 0.2,
            "gov": 0.7,
        },
    }
    
    # Synergy penalties (tags that conflict)
    SYNERGY_PENALTIES = {
        ("WAR", "PEACE_GROUP"): -20,
        ("CLIMATE", "OIL"): -15,
        ("HEALTH", "TOBACCO"): -25,
    }
    
    def calculate_scores(
        self,
        article_placements: Dict[str, Dict[str, Any]],
        ad_placements: Dict[str, Dict[str, Any]],
        articles: List[Dict[str, Any]],
        grid: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate final scores based on grid layout.
        
        Returns:
            {
                "final_score": float,
                "sales": int,
                "outrage_meter": float,
                "faction_balance": {"elite": float, "populace": float, "gov": float}
            }
        """
        total_score = 0.0
        faction_points = {"elite": 0.0, "populace": 0.0, "gov": 0.0}
        synergy_penalties = 0.0
        
        # Create article lookup
        article_dict = {a.get("id") or a.get("article_id"): a for a in articles}
        
        # Process article placements
        for position_str, placement in article_placements.items():
            position = int(position_str)
            article_id = placement["article_id"]
            variant = placement.get("variant", "factual")
            
            if article_id not in article_dict:
                continue
            
            article = article_dict[article_id]
            row = position // 4  # Which row (0-3)
            
            # Base score based on variant
            if variant == "factual":
                base_score = self.BASE_SCORE_FACTUAL
            elif variant == "sensationalist":
                base_score = self.BASE_SCORE_SENSATIONALIST
            else:  # propaganda
                base_score = self.BASE_SCORE_PROPAGANDA
            
            # Apply layout multiplier
            layout_mult = self.LAYOUT_MULTIPLIERS.get(row, 1.0)
            article_score = base_score * layout_mult
            
            total_score += article_score
            
            # Add faction points
            faction_mods = self.FACTION_MODIFIERS.get(variant, {})
            for faction, mod in faction_mods.items():
                faction_points[faction] += article_score * mod
            
            # Check for synergy penalties with adjacent cells
            synergy_penalties += self._check_synergy_penalties(
                position, article, grid, article_dict
            )
        
        # Calculate faction balance (normalized to sum to 1.0)
        total_faction_points = sum(faction_points.values())
        if total_faction_points > 0:
            faction_balance = {
                k: v / total_faction_points
                for k, v in faction_points.items()
            }
        else:
            faction_balance = {"elite": 0.33, "populace": 0.33, "gov": 0.34}
        
        # Apply synergy penalties
        total_score += synergy_penalties
        
        # Calculate sales (based on final score, with some randomness base)
        sales = max(100, int(total_score * 2))
        
        # Calculate outrage meter (0.0 - 1.0)
        # Higher outrage for more sensationalist/propaganda content
        sensational_count = sum(
            1 for p in article_placements.values()
            if p.get("variant") == "sensationalist"
        )
        propaganda_count = sum(
            1 for p in article_placements.values()
            if p.get("variant") == "propaganda"
        )
        total_articles = len(article_placements)
        if total_articles > 0:
            outrage_meter = min(1.0, (sensational_count * 0.3 + propaganda_count * 0.2) / total_articles)
        else:
            outrage_meter = 0.0
        
        return {
            "final_score": round(total_score, 2),
            "sales": sales,
            "outrage_meter": round(outrage_meter, 2),
            "faction_balance": {k: round(v, 3) for k, v in faction_balance.items()}
        }
    
    def _check_synergy_penalties(
        self,
        position: int,
        article: Dict[str, Any],
        grid: List[Dict[str, Any]],
        article_dict: Dict[int, Dict[str, Any]]
    ) -> float:
        """Check for synergy penalties with adjacent cells."""
        penalty = 0.0
        
        # Get article tags
        article_tags = article.get("tags", {}).get("topic_tags", []) if isinstance(article.get("tags"), dict) else []
        
        # Check adjacent cells (left, right, top, bottom)
        adjacent_positions = [
            position - 1 if position % 4 != 0 else None,  # Left
            position + 1 if position % 4 != 3 else None,  # Right
            position - 4 if position >= 4 else None,  # Top
            position + 4 if position < 12 else None,  # Bottom
        ]
        
        for adj_pos in adjacent_positions:
            if adj_pos is None or adj_pos < 0 or adj_pos >= 16:
                continue
            
            cell = grid[adj_pos]
            
            # Check if adjacent cell is an ad
            if cell.get("isAd") and cell.get("adId"):
                # For now, we don't have ad tags in the request
                # This would need ad data to check tags
                pass
            
            # Check if adjacent cell is an article
            elif cell.get("articleId"):
                adj_article_id = cell.get("articleId")
                if adj_article_id in article_dict:
                    adj_article = article_dict[adj_article_id]
                    adj_tags = adj_article.get("tags", {}).get("topic_tags", []) if isinstance(adj_article.get("tags"), dict) else []
                    
                    # Check for known synergy penalties
                    for article_tag in article_tags:
                        for adj_tag in adj_tags:
                            # Check both directions
                            if (article_tag, adj_tag) in self.SYNERGY_PENALTIES:
                                penalty += self.SYNERGY_PENALTIES[(article_tag, adj_tag)]
                            elif (adj_tag, article_tag) in self.SYNERGY_PENALTIES:
                                penalty += self.SYNERGY_PENALTIES[(adj_tag, article_tag)]
        
        return penalty

