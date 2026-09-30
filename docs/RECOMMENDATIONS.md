# Recommendations

Downloadarr builds personal recommendations for each person in your household:
albums on the Music page, and movies and shows on the Movies and TV pages.
Everything is set up in **Settings › Recommendations**.

## Profiles

A profile is one person. Each profile connects its own accounts:

| Account | What it adds | How it connects |
| --- | --- | --- |
| ListenBrainz | Listening stats, similar artists, fresh releases, Weekly/Daily Jams | Username (+ optional user token) |
| Last.fm | Top artists and albums, similar artists | Username + API key |
| Deezer | Favourites, charts, Flow | Public profile link |
| Spotify | Top/followed artists, saved albums and tracks | Sign in (needs the install's Spotify app) |
| Trakt | Personal movie and show recommendations, watchlist | Device code (needs the install's Trakt app) |

The switcher in the top bar picks whose recommendations to show. **Everyone**
merges all profiles: a title several people share appears once. Hiding
something while **Everyone** is picked hides it for every profile.

Upgrading from a version without profiles moves your existing accounts,
recommendations and hidden items to a profile named "Me". Rename it in
Settings.

Recommendations rebuild every night at 4am, and when you press **Refresh**.

## Trakt setup

1. Connect a verified GitHub account in Trakt's developer settings (Trakt
   requires this before you can create an app).
2. Create an app at <https://app.trakt.tv/settings/apps/api/new>. Set its
   redirect URI to `urn:ietf:wg:oauth:2.0:oob` — profiles sign in with a code,
   so nothing is redirected, but token refreshes must send the app's redirect
   URI.
3. Paste the app's client ID and secret under **App credentials**.
4. On each profile, press **Connect Trakt**, open trakt.tv/activate signed in
   as that person, and enter the code shown.

Things to know:

- Free Trakt accounts can connect **one** third-party app (since July 2026).
  Connecting Downloadarr uses that slot; VIP lifts the limit.
- Trakt deletes apps unused for 30 days. The nightly sync keeps it in use.
- Trakt's API policy forbids apps that promote piracy. Only use Downloadarr for
  content you own, and check the policy fits how you use it.
- Posters and details come from TMDB (Trakt doesn't allow hotlinking its
  images), so the TMDB key under **Discovery keys** must be set.
