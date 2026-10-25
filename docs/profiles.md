# Profiles

A library can have up to six profiles, so each person in the house can keep their own watch list. Each profile keeps its own:

- resume positions (where each movie was left off)
- watched marks
- hidden titles
- play history

Shelves and settings are shared by everyone. Profiles are stored on the server, not on a device, so if you start a movie on your phone and pick the same profile on the TV, it resumes at the same point.

The first profile is called **Home**. It is the owner profile, and it is created for you the first time the library runs.

## Picking a profile

- **In the web app:** when you open the library, a picker shows the profiles. Pick yours. Profiles with a lock have a PIN.
- **Switching:** click your profile chip in the header and choose **Switch profile**.
- **One profile, no PIN:** if the library has only Home and Home has no PIN, you never see the picker and nothing changes.

Your choice is remembered by the browser. Picking a profile on another device does not change this one.

## Managing profiles

Open **Settings → Profiles** to see the list.

| Action | Who can do it |
| --- | --- |
| Add a profile (up to six in total) | **Home** only |
| Rename or change the colour of a profile | That profile, or **Home** |
| Set, change or clear a PIN | That profile (it must type its current PIN to change it), or **Home** |
| Clear someone else's PIN | **Home** only |
| Delete a profile | **Home** only. Home itself cannot be deleted. |

Deleting a profile also deletes its watch progress, watched marks, hidden titles and play history.

Names must be unique (ignoring capitals) and up to 24 characters.

## Profile PINs

A profile PIN is 4 to 8 digits. It stops family members from seeing or changing each other's lists.

A profile PIN is **not security**. It only keeps the lists apart. Anyone on your network who can reach the library can still stream the files, with or without a profile PIN. To keep people off the server itself, use the **access PIN** (**Settings → Access PIN**). That is a separate setting: it guards the whole server, while profile PINs only guard each profile's lists.

## Forgotten PINs

**Another profile's PIN:** ask Home to clear it. In **Settings → Profiles**, Home sees **Clear PIN** on every other profile. Then set a new one if you want.

**Home's PIN or the access PIN:** these can only be reset from the server computer. Requests from other devices are refused.

- In the web app, open **Settings → Reset PINs** on the server computer. This clears Home's PIN and the access PIN.
- Or, from the repository folder on the server computer, run:

  ```bash
  npm run reset-pins --workspace @ottlib/server
  ```

  The command prints what it cleared. Clearing the access PIN signs every device out.

Both methods clear Home's PIN and the access PIN together. Neither one clears only one of them.

## Playing on a desktop

Playing a movie on a desktop computer opens it in **VLC** and starts where the profile left off.

If VLC is not installed, OttLib says so and offers two choices: get VLC from [videolan.org](https://www.videolan.org/), or open the file in your default player.

Progress from VLC on another computer is not reported back to the library yet, so a movie watched that way does not update its resume point.

## Android apps

The Android TV and phone apps support profiles the same way the web app does.

- **Picking:** on first connect the app asks **Who's watching?** when the library has two or more profiles, or when its only profile has a PIN. With one profile and no PIN there is no picker, and the app selects that profile on its own.
- **Remembered per server:** the app keeps your pick for each library. It asks again only when that profile session stops working, for example when the profile is deleted or its PIN is set from another device.
- **Switching:** tap the profile chip on Home (phone: the top app bar; TV: the top navigation bar), or choose **Switch profile** in Settings. Both show when the library has two or more profiles or the current profile has a PIN.
- **Managing profiles:** the phone app only, under **Settings → Profiles → Manage profiles**. It has the same rights as the web app: create, rename, colour, set, change or clear a PIN, and delete. The TV app only picks profiles and enters PINs. It says: "Add or edit profiles in the web app or the phone app."
- **Watch Next (TV):** switching profile clears the TV's Watch Next row, and the next playback fills it again.
- **Hidden titles:** on Android these are still kept per device, not per profile.

An app older than this update can't open a library with profiles. It shows "Pick a profile to continue. On Android TV or phone, update the OttLib app." To fix it, update the app (**Settings → update**). See [install.md](install.md) for how to update the apps.
