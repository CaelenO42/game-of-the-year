# Steam Endpoints Overview

A reference for commonly used Steam endpoints, whether each needs an API key, and the parameters it accepts.

| Endpoint | Key required |
|---|---|
| [Store Search](#1-store-search) | No |
| [App Details](#2-app-details) | No |
| [App Reviews](#3-app-reviews) (official and store) | No |
| [Player Summaries](#4-player-summaries) | **Yes** |
| [Current Players](#5-current-players) | No |
| [Global Achievement Percentages](#6-global-achievement-percentages) | No |
| [Achievement Schema](#7-achievement-schema) | **Yes** |
| [Player Achievements](#8-player-achievements) | **Yes** |
| [Owned Games](#9-owned-games) | **Yes** |

The store endpoints (search, appdetails, and store appreviews) are public but undocumented, so Valve may change them without notice. Everything on `api.steampowered.com` (sections 3a and 4-9) is part of the official Steam Web API.

> **Host note:** Valve's partner documentation lists these methods under `partner.steam-api.com`, which is intended for publishers. Non-publisher callers use `api.steampowered.com` with the same paths. Key requirements below follow the partner docs where stated; response shapes are from general knowledge of the API and are worth checking against a live request.

## 1. Store Search

**URL**: https://store.steampowered.com/search/results/

The endpoint behind the Steam store's search page. The response is JSON, but the results themselves are an HTML string (`results_html`). Each result's app ID can be read from its `data-ds-appid` attribute. `total_count` holds the total number of matches.

### Parameters

* `term` - Search string
* `infinite` - Set to `1` to return JSON instead of a full HTML page
* `supportedlang` - Language filter, e.g. `english` returns only games that support English
* `category1` - Category filter; `998` returns games only (excludes DLC, soundtracks, software, etc.)
* `count` - Number of results returned

## 2. App Details

**URL**: https://store.steampowered.com/api/appdetails

Main store data for an app: name, descriptions, images, developers and publishers, supported platforms, system requirements, screenshots, achievements, price, release date, and more. `release_date.coming_soon` indicates whether the app is unreleased.

The response is an object keyed by app ID. Each entry has a `success` boolean, and `data` is present only when `success` is `true`. Removed, region-locked, or non-store apps return `success: false`.

### Parameters

* `appids` - Steam App ID
* `cc` - Country code for regional pricing, e.g. `us`
* `l` - Language for text fields, e.g. `english`

## 3. App Reviews

Two endpoints return the same public review data. Prefer the official `IUserReviewsService`; the store endpoint is undocumented and kept here as a fallback.

### 3a. IUserReviewsService (official)

**URL**: https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/

The key is optional. A publisher key associated with the app raises the rate limit; calls without one share a lower limit, and exceeding it returns HTTP 429. It returns public reviews for any app.

All parameters are passed inside a single `input_json` query parameter as URL-encoded JSON. Enum-style options are integers rather than strings.

#### Parameters

* `appid` (required) - Steam App ID
* `key` - Publisher key, for the higher rate limit only
* `filter` - Sort order: `0` helpful (default), `1` recent, `2` updated, `3` funny. The helpful filter widens `day_range` until it finds results.
* `languages` - Array of language codes. Empty means English only; `["all"]` means every language.
* `day_range` - Helpful filter only. Days back to search (default 30, max 365, `0` for no limit).
* `cursor` - Pagination cursor. Use `*` or omit for the first page; pass the returned `cursor` for the next.
* `review_type` - `0` all (default), `1` positive, `2` negative
* `purchase_type` - `0` Steam purchases (default), `1` all, `2` non-Steam purchases
* `num_per_page` - Reviews per page (default 20, max 100)
* `filter_offtopic_activity` - Filters off-topic "review bombs" by default; pass `false` to include them
* `display_language` - Language for `review_score_desc` (default English)
* `use_review_quality` - Helpful filter only. Default `true`; ranks low-quality reviews lower.
* `date_range_start` / `date_range_end` - Unix timestamps. Each is ignored unless the other is also set.
* `date_range_exclude` - If `true`, excludes reviews inside the date range instead of keeping them
* `playtime_min_hours` / `playtime_max_hours` - Bounds on the author's playtime when the review was written
* `primarily_steam_deck` - Only reviews from authors who mostly played on Steam Deck
* `hardware_os`, `hardware_cpu`, `hardware_gpu`, `hardware_device_type` - Hardware filters

#### Response

* `query_summary` - `num_reviews` for the page. The score fields (`review_score`, `review_score_desc`, `total_positive`, `total_negative`, `total_reviews`) appear only on the first page, and only when `review_type` is `0`.
* `reviews` - Array of review objects: review ID, author info (Steam ID, review count, playtime, last played), language, text, timestamps, vote counts, comment count, purchase and early-access flags, developer response, Steam Deck flag, refund flag, and hardware details
* `cursor` - Pass back to fetch the next page
* `day_range_used` - Helpful filter only. The day range actually searched.
* `total_matching` - Total reviews matching the query

#### Review totals

Request with `languages: ["all"]` and `review_type: 0` and read `query_summary` on the first page for totals across all languages. Use a small `num_per_page` if only the summary is needed.

> **Differences from the store endpoint:** `purchase_type` defaults to Steam purchases only, an empty `languages` means English only, off-topic review bombs are filtered by default, and the filter options are integers.

### 3b. Store appreviews (undocumented)

**URL**: https://store.steampowered.com/appreviews/{steam_app_id}

Returns a review summary (`query_summary`) and a page of individual reviews (`reviews`). Each review includes the author's `steamid`, which can be passed to [Player Summaries](#4-player-summaries) to resolve profile details. Review text may contain BBCode-style markup.

#### Parameters

* `{steam_app_id}` (path) - Steam App ID
* `json` - Set to `1` to return JSON
* `filter` - Sort order: `all` (by helpfulness), `recent`, or `updated`
* `language` - Review language, e.g. `english`, or `all` for every language
* `purchase_type` - `all` (Steam purchases and key activations), `steam`, or `non_steam_purchase`
* `review_type` - `all`, `positive`, or `negative`
* `num_per_page` - Number of reviews returned (max 100)

#### Review totals

`query_summary` counts only reviews matching the request's filters, so it reflects a single language unless `language=all` is used. For exact totals across all languages, request with `language=all` and `num_per_page=0`, which returns just the summary without any individual reviews.

## 4. Player Summaries

**URL**: https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/

**Requires an API key.** Keys are issued at https://steamcommunity.com/dev/apikey.

Returns public profile information (display name, avatar, profile URL) for the given Steam IDs. Private profiles return limited data.

### Parameters

* `key` - Steam Web API key
* `steamids` - Comma-separated list of Steam IDs (max 100 per request)

## 5. Current Players

**URL**: https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/

Returns the number of players currently active in an app. Players who are playing while disconnected from Steam are not counted. The value is live and changes constantly, so it suits a short cache rather than permanent storage. The count is in `response.player_count`, with `response.result` set to `1` on success.

### Parameters

* `appid` - Steam App ID

## 6. Global Achievement Percentages

**URL**: https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/

Returns the percentage of all players who have unlocked each achievement in an app, which can be used to show achievement rarity. Each entry in `achievementpercentages.achievements` has the achievement's internal `name` (its API name, not the display name) and a `percent`. Use [Achievement Schema](#7-achievement-schema) to map the internal names to display names, descriptions, and icons.

### Parameters

* `gameid` - Steam App ID

> **Note:** The parameter is `gameid` here, unlike the other `ISteamUserStats` methods, which use `appid`.

## 7. Achievement Schema

**URL**: https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/

**Requires an API key.**

Returns the full list of stats and achievements defined for an app. Each achievement in `game.availableGameStats.achievements` includes its internal `name`, `displayName`, `description`, `hidden` flag, and icon URLs. Apps with no achievements or stats return an empty `game` object.

### Parameters

* `key` - Steam Web API key
* `appid` - Steam App ID
* `l` - Language for localized strings, e.g. `english`

> **Tip:** For just the number of achievements, `appdetails` already returns `achievements.total` without needing a key.

## 8. Player Achievements

**URL**: https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/

**Requires an API key.**

Returns a user's achievements for one app, including whether each is unlocked and when. It only works if the user's game details are public; otherwise the request returns an error.

### Parameters

* `key` - Steam Web API key
* `steamid` - 64-bit Steam ID of the user
* `appid` - Steam App ID
* `l` - Language for localized strings

## 9. Owned Games

**URL**: https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/

**Requires an API key.** Not covered by the page linked in the other sections, so the details below come from general knowledge of the API.

Returns the games a user owns, with total playtime per game. `playtime_forever` is in minutes. Like player achievements, this returns an empty result if the user's game details are private.

### Parameters

* `key` - Steam Web API key
* `steamid` - 64-bit Steam ID of the user
* `include_appinfo` - Set to `1` to include game names and icon hashes
* `include_played_free_games` - Set to `1` to include free-to-play games the user has played
* `appids_filter` - Optional list of App IDs to restrict the results to

## Other endpoints

* `ISteamUser/ResolveVanityURL/v1` (key required) - converts a custom profile URL name (`steamcommunity.com/id/<name>`) to a 64-bit Steam ID.
* `ISteamUserStats/GetUserStatsForGame/v2` (key required) - a user's raw stats for an app (kills, distance, etc.), as opposed to achievements.