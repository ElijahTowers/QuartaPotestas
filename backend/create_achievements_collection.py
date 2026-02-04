#!/usr/bin/env python3
"""
Script to create the achievements collection in PocketBase.
This creates a collection with all 100 achievements defined.
"""
import os
import sys
import asyncio
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.pocketbase_client import PocketBaseClient
from dotenv import load_dotenv

# All 100 achievements
ACHIEVEMENTS = [
    # === PUBLISHING MILESTONES (1-20) ===
    {"id": "first_edition", "name": "First Edition", "description": "Publish your first newspaper", "category": "publishing", "rarity": "common", "points": 10},
    {"id": "ten_editions", "name": "Weekly Reporter", "description": "Publish 10 newspapers", "category": "publishing", "rarity": "common", "points": 25},
    {"id": "fifty_editions", "name": "Monthly Veteran", "description": "Publish 50 newspapers", "category": "publishing", "rarity": "uncommon", "points": 50},
    {"id": "hundred_editions", "name": "Century Club", "description": "Publish 100 newspapers", "category": "publishing", "rarity": "rare", "points": 100},
    {"id": "five_hundred_editions", "name": "Publishing Legend", "description": "Publish 500 newspapers", "category": "publishing", "rarity": "epic", "points": 250},
    {"id": "thousand_editions", "name": "Millennium Master", "description": "Publish 1000 newspapers", "category": "publishing", "rarity": "legendary", "points": 500},
    {"id": "perfect_grid", "name": "Full House", "description": "Fill all 6 slots in your newspaper", "category": "publishing", "rarity": "common", "points": 15},
    {"id": "articles_only", "name": "Pure Journalism", "description": "Publish a newspaper with only articles (no ads)", "category": "publishing", "rarity": "uncommon", "points": 30},
    {"id": "ads_only", "name": "Advertiser's Dream", "description": "Publish a newspaper with only ads (no articles)", "category": "publishing", "rarity": "uncommon", "points": 30},
    {"id": "single_article", "name": "Minimalist", "description": "Publish a newspaper with only 1 article", "category": "publishing", "rarity": "rare", "points": 50},
    {"id": "all_factual", "name": "Truth Seeker", "description": "Publish a newspaper using only factual variants", "category": "publishing", "rarity": "uncommon", "points": 40},
    {"id": "all_sensationalist", "name": "Clickbait King", "description": "Publish a newspaper using only sensationalist variants", "category": "publishing", "rarity": "uncommon", "points": 40},
    {"id": "all_propaganda", "name": "Propaganda Master", "description": "Publish a newspaper using only propaganda variants", "category": "publishing", "rarity": "uncommon", "points": 40},
    {"id": "mixed_variants", "name": "Balanced Approach", "description": "Publish a newspaper with all 3 variant types", "category": "publishing", "rarity": "rare", "points": 60},
    {"id": "same_variant_row", "name": "Consistent Column", "description": "Publish a row with all articles using the same variant", "category": "publishing", "rarity": "uncommon", "points": 35},
    {"id": "top_spot", "name": "Headline Hero", "description": "Publish 100 articles in the top position", "category": "publishing", "rarity": "rare", "points": 75},
    {"id": "bottom_row", "name": "Bottom Feeder", "description": "Publish 100 articles in the bottom row", "category": "publishing", "rarity": "rare", "points": 75},
    {"id": "middle_row", "name": "Middle Ground", "description": "Publish 100 articles in the middle row", "category": "publishing", "rarity": "rare", "points": 75},
    {"id": "global_coverage", "name": "World Reporter", "description": "Publish articles from 50 different locations", "category": "publishing", "rarity": "epic", "points": 150},
    {"id": "local_focus", "name": "Hometown Hero", "description": "Publish 20 articles from the same city", "category": "publishing", "rarity": "uncommon", "points": 45},
    
    # === FINANCIAL ACHIEVEMENTS (21-35) ===
    {"id": "first_dollar", "name": "First Dollar", "description": "Earn your first dollar", "category": "financial", "rarity": "common", "points": 10},
    {"id": "hundred_dollars", "name": "Small Fortune", "description": "Accumulate $100 in treasury", "category": "financial", "rarity": "common", "points": 20},
    {"id": "thousand_dollars", "name": "Thousandaire", "description": "Accumulate $1,000 in treasury", "category": "financial", "rarity": "uncommon", "points": 50},
    {"id": "ten_thousand", "name": "Ten Grand", "description": "Accumulate $10,000 in treasury", "category": "financial", "rarity": "rare", "points": 100},
    {"id": "hundred_thousand", "name": "Hundred Grand", "description": "Accumulate $100,000 in treasury", "category": "financial", "rarity": "epic", "points": 250},
    {"id": "millionaire", "name": "Millionaire", "description": "Accumulate $1,000,000 in treasury", "category": "financial", "rarity": "legendary", "points": 500},
    {"id": "big_spender", "name": "Big Spender", "description": "Spend $10,000 total in the shop", "category": "financial", "rarity": "rare", "points": 100},
    {"id": "profitable_day", "name": "Profitable Day", "description": "Earn $1,000 profit in a single day", "category": "financial", "rarity": "uncommon", "points": 40},
    {"id": "massive_profit", "name": "Massive Profit", "description": "Earn $10,000 profit in a single day", "category": "financial", "rarity": "epic", "points": 200},
    {"id": "ad_revenue", "name": "Ad Revenue", "description": "Earn $5,000 total from ads", "category": "financial", "rarity": "rare", "points": 75},
    {"id": "bonus_hunter", "name": "Bonus Hunter", "description": "Earn $2,000 total from bonuses", "category": "financial", "rarity": "uncommon", "points": 45},
    {"id": "penalty_free", "name": "Penalty Free", "description": "Publish 10 newspapers without any penalties", "category": "financial", "rarity": "rare", "points": 80},
    {"id": "penalty_magnet", "name": "Penalty Magnet", "description": "Accumulate $5,000 in total penalties", "category": "financial", "rarity": "uncommon", "points": 35},
    {"id": "break_even", "name": "Break Even", "description": "Publish a newspaper with exactly $0 profit", "category": "financial", "rarity": "rare", "points": 100},
    {"id": "treasury_tycoon", "name": "Treasury Tycoon", "description": "Reach $5,000,000 in treasury", "category": "financial", "rarity": "legendary", "points": 1000},
    
    # === READERS & CREDIBILITY (36-50) ===
    {"id": "first_readers", "name": "First Readers", "description": "Reach 1,000 readers", "category": "readers", "rarity": "common", "points": 15},
    {"id": "ten_thousand_readers", "name": "Growing Audience", "description": "Reach 10,000 readers", "category": "readers", "rarity": "common", "points": 25},
    {"id": "hundred_thousand_readers", "name": "Popular Press", "description": "Reach 100,000 readers", "category": "readers", "rarity": "uncommon", "points": 60},
    {"id": "million_readers", "name": "Mass Media", "description": "Reach 1,000,000 readers", "category": "readers", "rarity": "epic", "points": 200},
    {"id": "ten_million_readers", "name": "Media Empire", "description": "Reach 10,000,000 readers", "category": "readers", "rarity": "legendary", "points": 500},
    {"id": "reader_spike", "name": "Viral Moment", "description": "Gain 50,000 readers in a single day", "category": "readers", "rarity": "epic", "points": 150},
    {"id": "credible_source", "name": "Credible Source", "description": "Reach 50 credibility", "category": "credibility", "rarity": "uncommon", "points": 50},
    {"id": "highly_credible", "name": "Highly Credible", "description": "Reach 80 credibility", "category": "credibility", "rarity": "rare", "points": 100},
    {"id": "perfect_credibility", "name": "Perfect Credibility", "description": "Reach 100 credibility", "category": "credibility", "rarity": "epic", "points": 250},
    {"id": "tabloid_trash", "name": "Tabloid Trash", "description": "Drop to 0 credibility", "category": "credibility", "rarity": "uncommon", "points": 30},
    {"id": "credibility_comeback", "name": "Redemption Arc", "description": "Go from 0 to 50+ credibility", "category": "credibility", "rarity": "epic", "points": 200},
    {"id": "steady_growth", "name": "Steady Growth", "description": "Gain readers for 7 consecutive days", "category": "readers", "rarity": "rare", "points": 75},
    {"id": "credibility_streak", "name": "Trustworthy", "description": "Maintain 70+ credibility for 10 days", "category": "credibility", "rarity": "epic", "points": 180},
    {"id": "reader_loss", "name": "Audience Exodus", "description": "Lose 20,000 readers in a single day", "category": "readers", "rarity": "uncommon", "points": 40},
    {"id": "balanced_metrics", "name": "Balanced Metrics", "description": "Have both 50+ credibility and 50,000+ readers", "category": "general", "rarity": "rare", "points": 90},
    
    # === FACTION ACHIEVEMENTS (51-70) ===
    {"id": "elite_favorite", "name": "Elite Favorite", "description": "Reach +10 score with Elite faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "working_class_hero", "name": "Working Class Hero", "description": "Reach +10 score with Working Class faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "patriot_ally", "name": "Patriot Ally", "description": "Reach +10 score with Patriots faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "syndicate_member", "name": "Syndicate Member", "description": "Reach +10 score with Syndicate faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "technocrat_friend", "name": "Technocrat Friend", "description": "Reach +10 score with Technocrats faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "faithful_supporter", "name": "Faithful Supporter", "description": "Reach +10 score with Faithful faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "resistance_agent", "name": "Resistance Agent", "description": "Reach +10 score with Resistance faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "doomer_ally", "name": "Doomer Ally", "description": "Reach +10 score with Doomers faction", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "faction_pariah", "name": "Faction Pariah", "description": "Reach -10 score with any faction", "category": "factions", "rarity": "uncommon", "points": 50},
    {"id": "universal_hate", "name": "Universally Hated", "description": "Have negative scores with all 8 factions", "category": "factions", "rarity": "epic", "points": 300},
    {"id": "universal_love", "name": "Universally Loved", "description": "Have positive scores with all 8 factions", "category": "factions", "rarity": "legendary", "points": 500},
    {"id": "neutral_ground", "name": "Neutral Ground", "description": "Keep all faction scores between -2 and +2 for 10 days", "category": "factions", "rarity": "epic", "points": 200},
    {"id": "faction_swing", "name": "Faction Swing", "description": "Go from -10 to +10 with the same faction", "category": "factions", "rarity": "legendary", "points": 400},
    {"id": "elite_enemy", "name": "Elite Enemy", "description": "Reach -10 score with Elite faction", "category": "factions", "rarity": "uncommon", "points": 45},
    {"id": "working_class_enemy", "name": "Working Class Enemy", "description": "Reach -10 score with Working Class faction", "category": "factions", "rarity": "uncommon", "points": 45},
    {"id": "faction_diversity", "name": "Faction Diversity", "description": "Have positive scores with 4 different factions", "category": "factions", "rarity": "rare", "points": 80},
    {"id": "faction_extremist", "name": "Faction Extremist", "description": "Have +8 or higher with one faction and -8 or lower with another", "category": "factions", "rarity": "epic", "points": 180},
    {"id": "balanced_factions", "name": "Balanced Factions", "description": "Keep all faction scores within 5 points of each other for 5 days", "category": "factions", "rarity": "rare", "points": 100},
    {"id": "faction_master", "name": "Faction Master", "description": "Reach +10 with 4 different factions", "category": "factions", "rarity": "legendary", "points": 400},
    
    # === SHOP & UPGRADES (71-80) ===
    {"id": "first_purchase", "name": "First Purchase", "description": "Buy your first upgrade from the shop", "category": "shop", "rarity": "common", "points": 20},
    {"id": "interns_buyer", "name": "Interns Buyer", "description": "Buy the Interns upgrade", "category": "shop", "rarity": "common", "points": 25},
    {"id": "slander_license", "name": "Slander License", "description": "Buy the Slander License upgrade", "category": "shop", "rarity": "uncommon", "points": 40},
    {"id": "coffee_machine", "name": "Coffee Machine", "description": "Buy the Coffee Machine upgrade", "category": "shop", "rarity": "common", "points": 20},
    {"id": "all_upgrades", "name": "Fully Upgraded", "description": "Buy all available upgrades", "category": "shop", "rarity": "epic", "points": 200},
    {"id": "upgrade_collector", "name": "Upgrade Collector", "description": "Buy 10 total upgrades", "category": "shop", "rarity": "rare", "points": 100},
    {"id": "expensive_taste", "name": "Expensive Taste", "description": "Buy an upgrade costing $1,000 or more", "category": "shop", "rarity": "uncommon", "points": 50},
    {"id": "pack_opener", "name": "Pack Opener", "description": "Open a booster pack", "category": "shop", "rarity": "common", "points": 15},
    {"id": "pack_collector", "name": "Pack Collector", "description": "Open 10 booster packs", "category": "shop", "rarity": "rare", "points": 90},
    {"id": "shop_regular", "name": "Shop Regular", "description": "Make 20 purchases from the shop", "category": "shop", "rarity": "epic", "points": 150},
    
    # === STREAKS & CONSISTENCY (81-90) ===
    {"id": "daily_publisher", "name": "Daily Publisher", "description": "Publish for 3 consecutive days", "category": "streaks", "rarity": "common", "points": 30},
    {"id": "week_warrior", "name": "Week Warrior", "description": "Publish for 7 consecutive days", "category": "streaks", "rarity": "uncommon", "points": 60},
    {"id": "month_marathon", "name": "Month Marathon", "description": "Publish for 30 consecutive days", "category": "streaks", "rarity": "epic", "points": 300},
    {"id": "hundred_day_streak", "name": "Hundred Day Streak", "description": "Publish for 100 consecutive days", "category": "streaks", "rarity": "legendary", "points": 1000},
    {"id": "consistent_earner", "name": "Consistent Earner", "description": "Earn profit for 10 consecutive days", "category": "streaks", "rarity": "rare", "points": 100},
    {"id": "reader_growth_streak", "name": "Reader Growth Streak", "description": "Gain readers for 5 consecutive days", "category": "streaks", "rarity": "uncommon", "points": 50},
    {"id": "credibility_streak", "name": "Credibility Streak", "description": "Maintain 60+ credibility for 14 consecutive days", "category": "streaks", "rarity": "epic", "points": 200},
    {"id": "perfect_week", "name": "Perfect Week", "description": "Publish every day for a week with profit each day", "category": "streaks", "rarity": "rare", "points": 120},
    {"id": "no_break", "name": "No Break", "description": "Publish for 14 consecutive days", "category": "streaks", "rarity": "rare", "points": 80},
    {"id": "streak_master", "name": "Streak Master", "description": "Maintain a 50+ day publishing streak", "category": "streaks", "rarity": "legendary", "points": 500},
    
    # === SPECIAL COMBINATIONS (91-100) ===
    {"id": "perfect_day", "name": "Perfect Day", "description": "Publish with max profit, max readers, and max credibility in one day", "category": "special", "rarity": "legendary", "points": 400},
    {"id": "jackpot", "name": "Jackpot", "description": "Earn $10,000+ profit with 100,000+ readers in a single day", "category": "special", "rarity": "legendary", "points": 500},
    {"id": "contradiction", "name": "Contradiction", "description": "Publish factual and propaganda variants of the same story", "category": "special", "rarity": "rare", "points": 80},
    {"id": "location_master", "name": "Location Master", "description": "Publish articles from 100 different locations", "category": "special", "rarity": "epic", "points": 250},
    {"id": "variant_master", "name": "Variant Master", "description": "Publish 100 of each variant type", "category": "special", "rarity": "epic", "points": 200},
    {"id": "sentiment_analyst", "name": "Sentiment Analyst", "description": "Publish articles with all different sentiment types", "category": "special", "rarity": "uncommon", "points": 45},
    {"id": "tag_collector", "name": "Tag Collector", "description": "Publish articles with 50 different topic tags", "category": "special", "rarity": "rare", "points": 100},
    {"id": "grid_artist", "name": "Grid Artist", "description": "Create a visually balanced grid layout 50 times", "category": "special", "rarity": "uncommon", "points": 50},
    {"id": "completionist", "name": "Completionist", "description": "Unlock 50 achievements", "category": "special", "rarity": "epic", "points": 300},
    {"id": "master_editor", "name": "Master Editor", "description": "Unlock all 100 achievements", "category": "special", "rarity": "legendary", "points": 1000},
]

async def create_achievements_collection():
    """Create achievements collection and populate with all achievements"""
    pb_client = PocketBaseClient()
    
    # Get admin credentials from environment
    admin_email = os.getenv("POCKETBASE_ADMIN_EMAIL", "")
    admin_password = os.getenv("POCKETBASE_ADMIN_PASSWORD", "")
    
    if not admin_email or not admin_password:
        print("❌ ERROR: POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment")
        return False
    
    print(f"🔐 Authenticating as admin: {admin_email}")
    authenticated = await pb_client.authenticate_admin(admin_email, admin_password)
    
    if not authenticated:
        print("❌ ERROR: Failed to authenticate with PocketBase admin credentials")
        return False
    
    print("✅ Admin authenticated successfully")
    print("")
    
    # Check if collection already exists
    try:
        collections = await pb_client.get_list("collections")
        existing = [c for c in collections if c.get("name") == "achievements"]
        
        if existing:
            print("⚠️  Achievements collection already exists")
            response = input("Do you want to recreate it? This will delete existing data. (yes/no): ")
            if response.lower() not in ["yes", "y"]:
                print("❌ Cancelled")
                return False
            
            # Delete existing collection
            collection_id = existing[0]["id"]
            # Note: PocketBase doesn't have a direct delete collection API, so we'll skip this
            print("⚠️  Cannot delete collection via API. Please delete manually in PocketBase admin UI if needed.")
    except Exception as e:
        print(f"⚠️  Could not check for existing collection: {e}")
    
    # Create collection schema
    # Note: PocketBase API expects "schema" in the request, but stores it as "fields"
    collection_schema = {
        "name": "achievements",
        "type": "base",
        "schema": [
            {
                "name": "achievement_id",
                "type": "text",
                "required": True,
                "unique": True,
                "presentable": True,
            },
            {
                "name": "name",
                "type": "text",
                "required": True,
                "presentable": True,
            },
            {
                "name": "description",
                "type": "text",
                "required": True,
            },
            {
                "name": "category",
                "type": "select",
                "required": True,
                "options": {
                    "values": ["publishing", "financial", "readers", "credibility", "factions", "shop", "streaks", "special", "general"],
                },
                "presentable": True,
            },
            {
                "name": "rarity",
                "type": "select",
                "required": True,
                "options": {
                    "values": ["common", "uncommon", "rare", "epic", "legendary"],
                },
                "presentable": True,
            },
            {
                "name": "points",
                "type": "number",
                "required": True,
                "presentable": True,
            },
        ],
    }
    
    print("📦 Creating achievements collection...")
    try:
        # Try to create collection via PocketBase admin API
        import httpx
        pocketbase_url = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
        
        # Check if collection exists
        async with httpx.AsyncClient(base_url=pocketbase_url, timeout=30.0) as client:
            # Get list of collections
            collections_response = await client.get(
                "/api/collections",
                headers={"Authorization": f"Bearer {pb_client.admin_token}"},
            )
            
            if collections_response.status_code == 200:
                collections = collections_response.json()
                existing = [c for c in collections.get("items", []) if c.get("name") == "achievements"]
                
                if existing:
                    collection_id = existing[0]["id"]
                    # Check if schema is empty
                    collection_details = await client.get(
                        f"/api/collections/{collection_id}",
                        headers={"Authorization": f"Bearer {pb_client.admin_token}"},
                    )
                    if collection_details.status_code == 200:
                        collection_data = collection_details.json()
                        schema = collection_data.get("schema", [])
                        if not schema or len(schema) == 0:
                            print("⚠️  Collection exists but has no schema. Deleting and recreating...")
                            # Delete collection
                            delete_response = await client.delete(
                                f"/api/collections/{collection_id}",
                                headers={"Authorization": f"Bearer {pb_client.admin_token}"},
                            )
                            if delete_response.status_code == 204:
                                print("✅ Deleted empty collection")
                                existing = []
                            else:
                                print(f"⚠️  Could not delete collection: {delete_response.status_code}")
                                print("   Please delete it manually in PocketBase admin UI")
                                return False
                        else:
                            print("✅ Achievements collection already exists with schema")
                
                if not existing:
                    # Create collection
                    print("   Creating collection via admin API...")
                    create_response = await client.post(
                        "/api/collections",
                        json=collection_schema,
                        headers={"Authorization": f"Bearer {pb_client.admin_token}"},
                    )
                    
                    if create_response.status_code == 200:
                        print("✅ Achievements collection created successfully")
                    else:
                        print(f"⚠️  Failed to create collection via API: {create_response.status_code} - {create_response.text}")
                        print("   Please create the collection manually in PocketBase admin UI")
                        print("   Schema:")
                        print(json.dumps(collection_schema, indent=2))
                        return False
            else:
                print(f"⚠️  Could not check collections: {collections_response.status_code}")
                print("   Please create the collection manually in PocketBase admin UI")
                print("   Schema:")
                print(json.dumps(collection_schema, indent=2))
                return False
        
        # Now create records
        print("📝 Creating achievement records...")
        created_count = 0
        skipped_count = 0
        
        for achievement in ACHIEVEMENTS:
            try:
                # Check if achievement already exists
                existing = await pb_client.get_list(
                    "achievements",
                    filter=f'achievement_id = "{achievement["id"]}"',
                )
                
                if existing and len(existing) > 0:
                    print(f"   ⏭️  Skipping {achievement['id']} (already exists)")
                    skipped_count += 1
                    continue
                
                # Create achievement record
                achievement_data = {
                    "achievement_id": achievement["id"],
                    "name": achievement["name"],
                    "description": achievement["description"],
                    "category": achievement["category"],
                    "rarity": achievement["rarity"],
                    "points": achievement["points"],
                }
                
                result = await pb_client.create_record("achievements", achievement_data)
                if result:
                    created_count += 1
                    print(f"   ✅ Created: {achievement['name']}")
                else:
                    print(f"   ❌ Failed: {achievement['name']}")
            except Exception as e:
                print(f"   ❌ Error creating {achievement['id']}: {e}")
        
        print("")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"✅ Achievements setup complete!")
        print(f"   Created: {created_count} achievements")
        print(f"   Skipped: {skipped_count} achievements (already exist)")
        print(f"   Total: {len(ACHIEVEMENTS)} achievements defined")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    await pb_client.close()
    return True


if __name__ == "__main__":
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🏆 Create Achievements Collection")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("")
    
    # Load environment variables from .env file
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded environment from: {env_path}")
    else:
        print(f"⚠️  No .env file found at: {env_path}")
        print("   Using system environment variables")
    print("")
    
    success = asyncio.run(create_achievements_collection())
    
    print("")
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

