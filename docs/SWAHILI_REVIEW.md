# Swahili translations to review (à relire)

**Status: every string below is a machine-assisted first draft and has NOT been reviewed by a native speaker.**
The goal was simple, everyday spoken Swahili (as used in Kilgoris / western Kenya), not literary Swahili.

How to review: edit `messages/sw.json` directly (keep the `{placeholders}` exactly as they are), then run
`npm run i18n:check` and `npm run i18n:review` to refresh this file.

## Terms worth a second opinion

| Concept | Used | Alternatives to consider |
|---|---|---|
| Boda rider | dereva wa Boda | mwendesha boda, bodaboda |
| Client / passenger | mteja | abiria |
| Ride request | ombi la safari | oda ya safari |
| "I am available" | Niko tayari | Nipo, Nipo kazini |
| "I am not available" | Siko tayari | Sipo, Sipo kazini |
| Pick-up point (client side) | Mahali pa kuchukuliwa | Kituo cha kuchukuliwa |
| Pick-up point (Boda side) | Mahali pa kumchukua mteja | Mahali pa kuchukua abiria |
| Confirm the ride | Thibitisha safari | Kubali safari imefanyika |
| Suspect (flagged ride) | Ina mashaka | Inatiliwa shaka |
| Cash | pesa taslimu | cash (many people just say "cash") |
| Plate number | Nambari ya pikipiki | Namba ya pikipiki |

Total strings: 352

## common

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `common.appName` | Boda Kilgoris | Boda Kilgoris |
| `common.tagline` | Find a motorbike taxi in Kilgoris | Pata boda boda hapa Kilgoris |
| `common.loading` | Loading… | Inapakia… |
| `common.retry` | Try again | Jaribu tena |
| `common.cancel` | Cancel | Ghairi |
| `common.close` | Close | Funga |
| `common.back` | Back | Rudi |
| `common.save` | Save | Hifadhi |
| `common.continue` | Continue | Endelea |
| `common.logout` | Log out | Toka |
| `common.settings` | Settings | Mipangilio |
| `common.call` | Call | Piga simu |
| `common.optional` | optional | si lazima |
| `common.yes` | Yes | Ndiyo |
| `common.no` | No | Hapana |
| `common.km` | {value} km | km {value} |
| `common.meters` | {value} m | m {value} |
| `common.minutesShort` | {count} min | dakika {count} |
| `common.kes` | KES {amount} | KES {amount} |
| `common.offline` | You are offline. Waiting for the network… | Huna mtandao. Tunasubiri mtandao… |
| `common.freeBanner` | Free to use during the first 3 months | Ni bure kwa miezi 3 ya kwanza |
| `common.away` | Away | Mbali |
| `common.showPassword` | Show | Onyesha |
| `common.hidePassword` | Hide | Ficha |

## language

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `language.title` | Choose your language | Chagua lugha yako |
| `language.subtitle` | You can change it later in Settings. | Unaweza kuibadilisha baadaye kwenye Mipangilio. |
| `language.label` | Language | Lugha |
| `language.changed` | Language changed | Lugha imebadilishwa |

## install

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `install.title` | Install the app | Weka programu kwenye simu |
| `install.body` | Add Boda Kilgoris to your home screen. It opens faster and works better on slow networks. | Weka Boda Kilgoris kwenye skrini ya simu yako. Inafunguka haraka na inafanya kazi vizuri hata mtandao ukiwa polepole. |
| `install.button` | Install | Weka |
| `install.later` | Later | Baadaye |

## welcome

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `welcome.intro` | Choose how you want to use the app. | Chagua jinsi unavyotaka kutumia programu. |
| `welcome.iAmBoda` | I am a Boda rider | Mimi ni dereva wa Boda |
| `welcome.iAmBodaHint` | Receive ride requests | Pokea maombi ya safari |
| `welcome.iAmClient` | I need a ride | Nahitaji safari |
| `welcome.iAmClientHint` | See Bodas near you | Ona Boda zilizo karibu nawe |
| `welcome.admin` | Admin | Msimamizi |
| `welcome.paymentNote` | Payment is in cash between you and the Boda. Nothing is paid in the app. | Malipo ni pesa taslimu kati yako na dereva wa Boda. Hakuna malipo kwenye programu. |

## geo

_Legal-ish consent text. Please check it is clear and complete: people must understand what is shared and with whom._

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `geo.consentTitle` | Share your location? | Ushiriki mahali ulipo? |
| `geo.consentBodyBoda` | While you are set as available, the app sends your position every 10 to 15 seconds so clients can see you on the map and choose you. When you are not available, nothing is sent. During a ride, the client who accepted you can follow you. | Ukiwa umeweka kuwa upo tayari, programu inatuma mahali ulipo kila sekunde 10 hadi 15 ili wateja wakuone kwenye ramani na wakuchague. Usipokuwa tayari, hakuna kinachotumwa. Wakati wa safari, mteja aliyekukubali anaweza kukufuatilia. |
| `geo.consentBodyClient` | The app uses your position to show the Bodas near you and to set your pick-up point. Your position is only shared with the Boda you choose, and only when you request a ride. You can also place the pick-up pin by hand on the map. | Programu inatumia mahali ulipo kuonyesha Boda zilizo karibu nawe na kuweka mahali pa kukuchukua. Mahali ulipo panashirikishwa tu na dereva wa Boda unayemchagua, na tu unapoomba safari. Pia unaweza kuweka alama ya kuchukuliwa mwenyewe kwenye ramani. |
| `geo.allow` | Allow location | Ruhusu mahali nilipo |
| `geo.notNow` | Not now | Si sasa |
| `geo.denied` | Location is blocked. Turn it on in your browser settings, then try again. | Mahali ulipo kumezuiwa. Washa kwenye mipangilio ya kivinjari chako, kisha jaribu tena. |
| `geo.unavailable` | We could not find your location. Move to an open place and try again. | Hatukuweza kupata mahali ulipo. Nenda mahali wazi, kisha jaribu tena. |
| `geo.timeout` | Finding your location takes too long. Try again. | Kupata mahali ulipo kunachukua muda mrefu. Jaribu tena. |
| `geo.unsupported` | This phone or browser cannot give a location. | Simu au kivinjari hiki hakiwezi kutoa mahali ulipo. |
| `geo.consentGiven` | You agreed to share your location. | Umekubali kushiriki mahali ulipo. |
| `geo.consentNone` | You have not agreed to share your location yet. | Bado hujakubali kushiriki mahali ulipo. |
| `geo.withdraw` | Withdraw my consent | Ondoa ruhusa yangu |
| `geo.withdrawn` | Consent withdrawn | Ruhusa imeondolewa |

## auth

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `auth.name` | Full name | Jina kamili |
| `auth.phone` | Phone number | Nambari ya simu |
| `auth.phoneHint` | Example: 0712 345 678 | Mfano: 0712 345 678 |
| `auth.pin` | 4-digit PIN | PIN ya tarakimu 4 |
| `auth.pinConfirm` | Repeat the PIN | Rudia PIN |
| `auth.pinHint` | Choose 4 digits you will remember. Do not share it. | Chagua tarakimu 4 utakazozikumbuka. Usimwambie mtu yeyote. |
| `auth.plate` | Motorbike plate number | Nambari ya pikipiki |
| `auth.plateHint` | Example: KMFA 123A | Mfano: KMFA 123A |
| `auth.photo` | Your photo | Picha yako |
| `auth.photoHint` | A clear photo of your face. Clients see it. | Picha safi ya uso wako. Wateja wataiona. |
| `auth.login` | Log in | Ingia |
| `auth.register` | Create my account | Fungua akaunti yangu |
| `auth.haveAccount` | I already have an account | Nina akaunti tayari |
| `auth.noAccount` | I do not have an account yet | Sina akaunti bado |
| `auth.start` | Start | Anza |
| `auth.email` | Email | Barua pepe |
| `auth.password` | Password | Nenosiri |
| `auth.bodaLoginTitle` | Boda login | Kuingia kwa dereva wa Boda |
| `auth.bodaRegisterTitle` | Become a Boda on the app | Jiunge kama dereva wa Boda |
| `auth.bodaRegisterIntro` | The admin will check your account before you can receive rides. | Msimamizi ataangalia akaunti yako kabla hujaanza kupokea safari. |
| `auth.clientStartTitle` | Who are you? | Wewe ni nani? |
| `auth.clientStartIntro` | No password. Just your name and your phone number. | Hakuna nenosiri. Jina lako na nambari ya simu tu. |
| `auth.adminLoginTitle` | Admin login | Kuingia kwa msimamizi |
| `auth.pinMismatch` | The two PINs are not the same. | PIN mbili hazifanani. |
| `auth.registered` | Account created. It is waiting for approval. | Akaunti imefunguliwa. Inasubiri idhini. |
| `auth.loggingIn` | Logging in… | Inaingia… |
| `auth.photoCamera` | Take a photo | Piga picha |
| `auth.photoRetake` | Take another photo | Piga picha nyingine |
| `auth.photoGallery` | Choose from gallery | Chagua kwenye picha zako |
| `auth.photoProcessing` | Preparing your photo… | Tunaandaa picha yako… |
| `auth.photoUploading` | Sending your photo… | Tunatuma picha yako… |
| `auth.photoSaved` | Photo saved ✓ | Picha imehifadhiwa ✓ |
| `auth.photoRetry` | Try sending again | Jaribu kutuma tena |
| `auth.photoLater` | Add a photo later | Weka picha baadaye |
| `auth.photoContinue` | Continue | Endelea |
| `auth.photoStepTitle` | Add your photo | Weka picha yako |
| `auth.accountCreated` | Your account is created ✓ You can add your photo now, or later from the home page. | Akaunti yako imeundwa ✓ Unaweza kuweka picha yako sasa, au baadaye kwenye ukurasa wa mwanzo. |
| `auth.photoRestarted` | The app restarted while the camera was open. Your account is safe. Please try the photo again. | Programu ilianza upya wakati kamera ilikuwa wazi. Akaunti yako iko salama. Tafadhali jaribu kupiga picha tena. |
| `auth.draftRestored` | We kept what you typed. Please enter your PIN again. | Tumehifadhi ulichoandika. Tafadhali weka PIN yako tena. |

## settings

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `settings.title` | Settings | Mipangilio |
| `settings.account` | Account | Akaunti |
| `settings.location` | Location | Mahali ulipo |
| `settings.about` | About | Kuhusu programu |
| `settings.phaseNote` | Phase 1: the app is free. Payment is in cash between you and the Boda. | Awamu ya 1: programu ni bure. Malipo ni pesa taslimu kati yako na dereva wa Boda. |
| `settings.version` | Version {version} | Toleo {version} |

## boda

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `boda.greeting` | Hello, {name} | Habari, {name} |
| `boda.available` | I am available | Niko tayari |
| `boda.unavailable` | I am not available | Siko tayari |
| `boda.tapToGoOnline` | Tap to go online | Gusa ili uanze kupokea safari |
| `boda.tapToGoOffline` | Tap to go offline | Gusa ili uache kupokea safari |
| `boda.onlineHint` | Clients can see you on the map and send you requests. | Wateja wanakuona kwenye ramani na wanaweza kukutumia maombi. |
| `boda.offlineHint` | You are hidden. No location is shared. | Umefichwa. Mahali ulipo hapashirikishwi. |
| `boda.gettingLocation` | Getting your location… | Tunatafuta mahali ulipo… |
| `boda.tracking` | Location shared · sent {seconds}s ago | Mahali kunashirikishwa · kulitumwa sekunde {seconds} zilizopita |
| `boda.trackingWaiting` | Waiting for the first location… | Tunasubiri mahali ulipo kwa mara ya kwanza… |
| `boda.keepScreenOn` | Keep this screen open while you are available so your location stays up to date. | Acha skrini hii wazi ukiwa tayari, ili mahali ulipo pabaki sahihi. |
| `boda.pendingTitle` | Waiting for approval | Inasubiri idhini |
| `boda.pendingBody` | The admin is checking your account. You can go online as soon as it is approved. | Msimamizi anaangalia akaunti yako. Utaweza kuanza mara tu itakapokubaliwa. |
| `boda.suspendedTitle` | Account suspended | Akaunti imesimamishwa |
| `boda.suspendedBody` | Your account is suspended. Please contact the admin. | Akaunti yako imesimamishwa. Tafadhali wasiliana na msimamizi. |
| `boda.refresh` | Check again | Angalia tena |
| `boda.incomingTitle` | New ride request | Ombi jipya la safari |
| `boda.client` | Client | Mteja |
| `boda.destination` | Destination | Anakokwenda |
| `boda.pickupPoint` | Pick-up point | Mahali pa kumchukua mteja |
| `boda.distanceFromYou` | {distance} from you | {distance} kutoka ulipo |
| `boda.expiresIn` | Expires in {time} | Linaisha baada ya {time} |
| `boda.accept` | Accept | Kubali |
| `boda.decline` | Decline | Kataa |
| `boda.noRequests` | No request yet. Stay available and keep this screen open. | Bado hakuna ombi. Endelea kuwa tayari na uache skrini hii wazi. |
| `boda.currentRide` | Current ride | Safari ya sasa |
| `boda.goToClient` | Go to the client's pick-up point. | Nenda mahali pa kumchukua mteja. |
| `boda.atPickup` | Tell the client you are there. | Mwambie mteja kuwa umefika. |
| `boda.riding` | Ride in progress. | Safari inaendelea. |
| `boda.arrived` | I have arrived | Nimefika |
| `boda.complete` | Ride completed | Safari imekwisha |
| `boda.callClient` | Call {name} | Mpigie {name} |
| `boda.priceTitle` | Price agreed (KES) | Bei mliyokubaliana (KES) |
| `boda.priceHint` | Optional. The cash amount you agreed with the client. | Si lazima. Kiasi cha pesa taslimu mlichokubaliana na mteja. |
| `boda.pricePlaceholder` | e.g. 100 | mfano: 100 |
| `boda.finish` | Finish the ride | Maliza safari |
| `boda.cancelRide` | Cancel the ride | Ghairi safari |
| `boda.cancelConfirm` | Cancel this ride? | Unataka kughairi safari hii? |
| `boda.justFinished` | Ride finished | Safari imekwisha |
| `boda.waitingConfirm` | Waiting for the client to confirm. The ride is counted when you both confirmed. It is automatic after {minutes} minutes. | Tunasubiri mteja athibitishe. Safari inahesabiwa mkithibitisha nyote wawili. Inathibitishwa yenyewe baada ya dakika {minutes}. |
| `boda.counted` | Counted ✓ | Imehesabiwa ✓ |
| `boda.ridesToday` | Rides today | Safari za leo |
| `boda.yourRating` | Your rating | Alama zako |
| `boda.noRating` | No rating yet | Bado hakuna alama |
| `boda.tapAvailable` | Tap “I am available” when you are ready for rides. | Gusa “Niko tayari” ukiwa tayari kupokea safari. |
| `boda.clientCancelled` | {name} cancelled the request. | {name} amefuta ombi. |
| `boda.requestExpired` | A request expired. | Ombi moja limeisha muda. |
| `boda.addPhotoTitle` | Add your photo | Weka picha yako |
| `boda.addPhotoBody` | Clients like to see who they ride with. It also helps the admin approve you. | Wateja wanapenda kuona nani atawabeba. Pia inamsaidia msimamizi kukuidhinisha. |
| `boda.destinationToClarify` | Destination to be confirmed with the client | Mahali pa kwenda: kubaliana na mteja |
| `boda.destinationOnMap` | Shown on the map | Inaonekana kwenye ramani |
| `boda.pickupNote` | Pick-up landmark | Alama ya mahali pa kuchukuliwa |

## client

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `client.hello` | Hello, {name} | Habari, {name} |
| `client.bodasNow` | Bodas available now | Boda zilizo tayari sasa |
| `client.noBodas` | No Boda is available right now. This list updates by itself. | Hakuna Boda iliyo tayari sasa hivi. Orodha hii inajisasisha yenyewe. |
| `client.away` | {distance} away (approx.) | {distance} kutoka ulipo (takriban) |
| `client.rating` | {rating} ({count}) | {rating} ({count}) |
| `client.noRating` | New | Mpya |
| `client.request` | Request this Boda | Omba Boda huyu |
| `client.pickup` | Pick-up point | Mahali pa kuchukuliwa |
| `client.pickupGps` | Your position | Mahali ulipo |
| `client.pickupPin` | Pin on the map | Alama kwenye ramani |
| `client.useMyLocation` | Use my location | Tumia mahali nilipo |
| `client.locating` | Finding you… | Tunakutafuta… |
| `client.tapMap` | Tap the map to place the pick-up pin. | Gusa ramani ili kuweka alama ya mahali pa kuchukuliwa. |
| `client.destinationLabel` | Where are you going? (optional) | Unakwenda wapi? (si lazima) |
| `client.destinationPlaceholder` | Landmark, area or place (e.g. near the market) | Alama, eneo au mahali (mfano: karibu na soko) |
| `client.waitingTitle` | Waiting for {name}… | Tunamsubiri {name}… |
| `client.waitingBody` | Your request expires in {time}. | Ombi lako linaisha baada ya {time}. |
| `client.cancelRequest` | Cancel the request | Ghairi ombi |
| `client.declined` | {name} cannot take your ride. Please choose another Boda. | {name} hawezi kukubeba. Tafadhali chagua Boda mwingine. |
| `client.expired` | {name} did not answer. Please choose another Boda. | {name} hajajibu. Tafadhali chagua Boda mwingine. |
| `client.cancelledByBoda` | {name} cancelled the ride. | {name} ameghairi safari. |
| `client.onTheWay` | {name} is on the way | {name} yuko njiani |
| `client.hasArrived` | {name} has arrived | {name} amefika |
| `client.eta` | About {minutes} min away | Takriban dakika {minutes} kufika |
| `client.plate` | Plate: {plate} | Nambari ya pikipiki: {plate} |
| `client.callBoda` | Call {name} | Mpigie {name} |
| `client.cancelRide` | Cancel the ride | Ghairi safari |
| `client.cancelConfirm` | Cancel this ride? | Unataka kughairi safari hii? |
| `client.completedTitle` | Ride finished | Safari imekwisha |
| `client.completedBody` | Please confirm that the ride took place. | Tafadhali thibitisha kuwa safari ilifanyika. |
| `client.priceNoted` | Price noted by the Boda: {amount} | Bei aliyoandika dereva: {amount} |
| `client.confirm` | Confirm the ride | Thibitisha safari |
| `client.rateTitle` | How was the ride? | Safari ilikuwaje? |
| `client.rateOptional` | Rating is optional | Kutoa alama si lazima |
| `client.stars` | {count, plural, one {# star} other {# stars}} | {count, plural, one {nyota #} other {nyota #}} |
| `client.thanks` | Thank you! The ride is confirmed. | Asante! Safari imethibitishwa. |
| `client.newRide` | Back to the map | Rudi kwenye ramani |
| `client.refreshList` | Refresh | Sasisha |
| `client.destinationHint` | You can leave this empty and tell the Boda when he arrives. | Unaweza kuacha wazi na kumwambia Boda atakapofika. |
| `client.placesLabel` | Quick places | Mahali pa kawaida |
| `client.placeOnMap` | Place on the map | Weka kwenye ramani |
| `client.placingHint` | Tap the map where you want to go. | Gusa ramani mahali unapokwenda. |
| `client.cancelPlacing` | Cancel | Ghairi |
| `client.destinationPinned` | Destination placed on the map | Mahali pa kwenda pamewekwa kwenye ramani |
| `client.removePin` | Remove | Ondoa |
| `client.pickupNoteLabel` | Pick-up landmark (optional) | Alama ya mahali pa kuchukuliwa (si lazima) |
| `client.pickupNoteHint` | Helps the Boda find you. | Inamsaidia Boda kukupata. |
| `client.pickupNotePlaceholder` | Example: in front of the blue shop | Mfano: mbele ya duka la buluu |
| `client.gpsFallback` | We could not get your GPS position. Tap the map to place your pick-up pin. | Hatukuweza kupata mahali ulipo kwa GPS. Gusa ramani kuweka alama ya mahali pa kuchukuliwa. |
| `client.gpsImprecise` | Your GPS is not very precise (about {meters} m). Check the pin, or tap the map to move it. | GPS yako si sahihi sana (karibu mita {meters}). Angalia alama, au gusa ramani kuihamisha. |

## ride

_Ride status words appear as small badges: they must stay short._

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `ride.status.requested` | Requested | Imeombwa |
| `ride.status.accepted` | Accepted | Imekubaliwa |
| `ride.status.arrived` | Arrived | Amefika |
| `ride.status.completed` | Completed | Imekamilika |
| `ride.status.declined` | Declined | Imekataliwa |
| `ride.status.expired` | Expired | Imeisha muda |
| `ride.status.cancelled` | Cancelled | Imeghairiwa |
| `ride.counted` | Counted | Imehesabiwa |
| `ride.notCounted` | Not counted | Haijahesabiwa |
| `ride.suspect` | Suspect | Ina mashaka |
| `ride.autoConfirmed` | Auto-confirmed | Imethibitishwa yenyewe |
| `ride.reason.too_fast` | Too fast (under 2 minutes) | Haraka mno (chini ya dakika 2) |
| `ride.reason.pair_frequency` | Same client and Boda: more than 10 rides in a day | Mteja na Boda yuleyule: safari zaidi ya 10 kwa siku |
| `ride.cancelledBy.client` | by client | na mteja |
| `ride.cancelledBy.boda` | by Boda | na dereva |
| `ride.cancelledBy.system` | by system | na mfumo |

## notify

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `notify.newRequest` | New ride request! | Ombi jipya la safari! |
| `notify.accepted` | {name} accepted your ride. | {name} amekubali safari yako. |
| `notify.arrived` | {name} has arrived. | {name} amefika. |
| `notify.completed` | The ride is finished. Please confirm it. | Safari imekwisha. Tafadhali ithibitishe. |
| `notify.tapToOpen` | Tap to open | Gusa kufungua |

## admin

_Used only by the admin: lower priority, but numbers/terms should be consistent._

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `admin.title` | Admin | Msimamizi |
| `admin.nav.overview` | Overview | Muhtasari |
| `admin.nav.bodas` | Bodas | Boda |
| `admin.nav.rides` | Rides | Safari |
| `admin.nav.map` | Live map | Ramani ya moja kwa moja |
| `admin.nav.places` | Places | Maeneo |
| `admin.overview.question` | How many real rides go through the app? | Ni safari ngapi za kweli zinapita kwenye programu? |
| `admin.overview.counted` | Counted rides | Safari zilizohesabiwa |
| `admin.overview.countedHint` | Confirmed by both the Boda and the client | Zimethibitishwa na dereva na mteja wote wawili |
| `admin.overview.today` | Today | Leo |
| `admin.overview.week` | This week | Wiki hii |
| `admin.overview.month` | This month | Mwezi huu |
| `admin.overview.total` | Total | Jumla |
| `admin.overview.clean` | Counted, not suspect | Zilizohesabiwa, zisizo na mashaka |
| `admin.overview.suspect` | Suspect rides | Safari zenye mashaka |
| `admin.overview.requests` | Ride requests | Maombi ya safari |
| `admin.overview.acceptanceRate` | Acceptance rate (30 days) | Kiwango cha kukubali (siku 30) |
| `admin.overview.avgAccept` | Average time to accept (30 days) | Muda wa wastani wa kukubali (siku 30) |
| `admin.overview.activeBodas` | Active Bodas | Boda zilizofanya kazi |
| `admin.overview.availableNow` | Available now | Zilizo tayari sasa |
| `admin.overview.pending` | Waiting for approval | Zinazosubiri idhini |
| `admin.overview.approved` | Approved Bodas | Boda zilizokubaliwa |
| `admin.overview.suspended` | Suspended Bodas | Boda zilizosimamishwa |
| `admin.overview.awaitingConfirmation` | Waiting for client confirmation | Zinazosubiri mteja athibitishe |
| `admin.overview.autoConfirmed` | Auto-confirmed this month | Zilizothibitishwa zenyewe mwezi huu |
| `admin.overview.perDay` | Per day | Kwa siku |
| `admin.overview.last14` | Last 14 days | Siku 14 zilizopita |
| `admin.overview.legendClean` | Counted | Zilizohesabiwa |
| `admin.overview.legendSuspect` | Suspect | Zenye mashaka |
| `admin.overview.legendUnconfirmed` | Not confirmed | Hazijathibitishwa |
| `admin.overview.day` | Day | Siku |
| `admin.overview.noData` | No data yet. | Bado hakuna takwimu. |
| `admin.bodas.title` | Bodas | Boda |
| `admin.bodas.filterAll` | All | Zote |
| `admin.bodas.search` | Search name, phone or plate | Tafuta jina, simu au nambari ya pikipiki |
| `admin.bodas.name` | Boda | Dereva |
| `admin.bodas.phone` | Phone | Simu |
| `admin.bodas.plate` | Plate | Nambari ya pikipiki |
| `admin.bodas.status` | Status | Hali |
| `admin.bodas.requests` | Requests | Maombi |
| `admin.bodas.accepted` | Accepted | Yaliyokubaliwa |
| `admin.bodas.acceptance` | Acceptance | Kukubali |
| `admin.bodas.counted` | Counted | Zilizohesabiwa |
| `admin.bodas.suspect` | Suspect | Zenye mashaka |
| `admin.bodas.rating` | Rating | Alama |
| `admin.bodas.lastOnline` | Last online | Mara ya mwisho mtandaoni |
| `admin.bodas.never` | Never | Hajawahi |
| `admin.bodas.approve` | Approve | Kubali |
| `admin.bodas.suspend` | Suspend | Simamisha |
| `admin.bodas.reactivate` | Reactivate | Rudisha |
| `admin.bodas.resetPin` | Reset PIN | Badilisha PIN |
| `admin.bodas.resetPinPrompt` | New 4-digit PIN for {name}: | PIN mpya ya tarakimu 4 ya {name}: |
| `admin.bodas.pinReset` | PIN changed. Tell the Boda. | PIN imebadilishwa. Mwambie dereva. |
| `admin.bodas.statusChanged` | Status updated | Hali imebadilishwa |
| `admin.bodas.status_pending` | Pending | Inasubiri |
| `admin.bodas.status_approved` | Approved | Amekubaliwa |
| `admin.bodas.status_suspended` | Suspended | Amesimamishwa |
| `admin.bodas.noBodas` | No Bodas found. | Hakuna Boda aliyepatikana. |
| `admin.rides.title` | Rides | Safari |
| `admin.rides.from` | From | Kuanzia |
| `admin.rides.to` | To | Hadi |
| `admin.rides.onlyCounted` | Counted only | Zilizohesabiwa tu |
| `admin.rides.onlySuspect` | Suspect only | Zenye mashaka tu |
| `admin.rides.exportCsv` | Export CSV | Pakua CSV |
| `admin.rides.when` | When | Lini |
| `admin.rides.client` | Client | Mteja |
| `admin.rides.boda` | Boda | Dereva |
| `admin.rides.status` | Status | Hali |
| `admin.rides.price` | Price | Bei |
| `admin.rides.flags` | Flags | Alama |
| `admin.rides.duration` | Duration | Muda |
| `admin.rides.noRides` | No rides in this period. | Hakuna safari katika kipindi hiki. |
| `admin.rides.showing` | Showing {count} rides | Safari {count} zinaonyeshwa |
| `admin.rides.limitReached` | Only the latest {count} are shown. Narrow the dates or export the CSV. | Safari {count} za mwisho tu ndizo zinaonyeshwa. Punguza tarehe au pakua CSV. |
| `admin.map.title` | Available Bodas | Boda zilizo tayari |
| `admin.map.none` | No Boda is available right now. | Hakuna Boda iliyo tayari sasa hivi. |
| `admin.map.count` | {count, plural, =0 {No Boda available} one {# Boda available} other {# Bodas available}} | {count, plural, =0 {Hakuna Boda iliyo tayari} one {Boda # iko tayari} other {Boda # ziko tayari}} |
| `admin.places.title` | Frequent places | Maeneo ya kawaida |
| `admin.places.intro` | Clients see these as quick buttons under the destination field. Add the real places of Kilgoris. Deactivating a place only hides it; past rides are not changed. | Wateja wanaona haya kama vitufe vya haraka chini ya sehemu ya mahali pa kwenda. Weka maeneo halisi ya Kilgoris. Kuficha eneo hakubadilishi safari zilizopita. |
| `admin.places.addTitle` | Add a place | Ongeza eneo |
| `admin.places.editTitle` | Edit this place | Badilisha eneo hili |
| `admin.places.name` | Name | Jina |
| `admin.places.namePlaceholder` | Example: Kilgoris Market | Mfano: Soko la Kilgoris |
| `admin.places.lat` | Latitude | Latitudo |
| `admin.places.lng` | Longitude | Longitudo |
| `admin.places.coordsHint` | Tap the map to set the position, or paste coordinates like -1.0035, 34.8767. | Gusa ramani kuweka mahali, au bandika viwianishi kama -1.0035, 34.8767. |
| `admin.places.add` | Add the place | Ongeza eneo |
| `admin.places.saveChanges` | Save changes | Hifadhi mabadiliko |
| `admin.places.cancelEdit` | Cancel | Ghairi |
| `admin.places.saved` | Saved | Imehifadhiwa |
| `admin.places.empty` | No places yet. Add the first one above. | Hakuna maeneo bado. Ongeza la kwanza hapo juu. |
| `admin.places.active` | Active | Linatumika |
| `admin.places.inactive` | Hidden | Limefichwa |
| `admin.places.edit` | Edit | Badilisha |
| `admin.places.deactivate` | Hide | Ficha |
| `admin.places.activate` | Show again | Onyesha tena |

## errors

_Shown to people when something fails: must be short and not blaming._

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `errors.generic` | Something went wrong. Please try again. | Kuna tatizo. Tafadhali jaribu tena. |
| `errors.network` | No connection. Check your network and try again. | Hakuna mtandao. Angalia mtandao wako, kisha jaribu tena. |
| `errors.invalid_credentials` | Wrong phone number or PIN. | Nambari ya simu au PIN si sahihi. |
| `errors.invalid_admin_credentials` | Wrong email or password. | Barua pepe au nenosiri si sahihi. |
| `errors.too_many_attempts` | Too many wrong attempts. Try again in 15 minutes. | Umekosea mara nyingi. Jaribu tena baada ya dakika 15. |
| `errors.invalid_name` | Please enter your full name. | Tafadhali andika jina lako kamili. |
| `errors.invalid_phone` | This phone number is not valid. Use a Kenyan number like 0712 345 678. | Nambari hii ya simu si sahihi. Tumia nambari ya Kenya kama 0712 345 678. |
| `errors.invalid_pin` | The PIN must be exactly 4 digits. | PIN lazima iwe na tarakimu 4 kamili. |
| `errors.invalid_plate` | Please enter a valid plate number. | Tafadhali andika nambari sahihi ya pikipiki. |
| `errors.photo_required` | Please add your photo. | Tafadhali weka picha yako. |
| `errors.photo_too_large` | This photo is too big. Choose a smaller one. | Picha hii ni kubwa mno. Chagua ndogo zaidi. |
| `errors.phone_in_use` | This phone number is already used. | Nambari hii ya simu inatumika tayari. |
| `errors.plate_in_use` | This plate number is already registered. | Nambari hii ya pikipiki imesajiliwa tayari. |
| `errors.role_mismatch` | This number belongs to another type of account. | Nambari hii ni ya aina nyingine ya akaunti. |
| `errors.forbidden` | You are not allowed to do this. | Huruhusiwi kufanya hili. |
| `errors.not_authenticated` | Please log in again. | Tafadhali ingia tena. |
| `errors.invalid_language` | This language is not available. | Lugha hii haipatikani. |
| `errors.not_a_boda` | This account is not a Boda account. | Akaunti hii si ya dereva wa Boda. |
| `errors.not_a_client` | This account is not a client account. | Akaunti hii si ya mteja. |
| `errors.boda_not_approved` | Your account is not approved. | Akaunti yako haijakubaliwa. |
| `errors.boda_unavailable` | This Boda is no longer available. Choose another one. | Boda huyu hayuko tayari tena. Chagua mwingine. |
| `errors.client_has_active_ride` | You already have a ride in progress. | Tayari una safari inayoendelea. |
| `errors.ride_not_found` | This ride was not found. | Safari hii haikupatikana. |
| `errors.ride_expired` | This request has expired. | Ombi hili limeisha muda. |
| `errors.invalid_state` | This ride has already changed. The screen was refreshed. | Safari hii imebadilika tayari. Skrini imesasishwa. |
| `errors.invalid_transition` | This ride has already changed. The screen was refreshed. | Safari hii imebadilika tayari. Skrini imesasishwa. |
| `errors.ride_in_progress` | You have a ride in progress. | Una safari inayoendelea. |
| `errors.boda_busy` | You already have a ride in progress. | Tayari una safari inayoendelea. |
| `errors.not_available` | You are not set as available. | Hujaweka kuwa uko tayari. |
| `errors.invalid_location` | The location is not valid. | Mahali si sahihi. |
| `errors.invalid_price` | The price is not valid. | Bei si sahihi. |
| `errors.invalid_rating` | The rating must be from 1 to 5. | Alama lazima ziwe kati ya 1 na 5. |
| `errors.not_found` | Not found. | Haikupatikana. |
| `errors.photo_unreadable` | We could not read this photo. Please take or choose another one. | Hatukuweza kusoma picha hii. Tafadhali piga au chagua nyingine. |
| `errors.photo_upload_failed` | The photo could not be saved. Please try again. | Picha haikuweza kuhifadhiwa. Tafadhali jaribu tena. |
| `errors.invalid_place` | Please enter a name and valid coordinates. | Tafadhali weka jina na viwianishi sahihi. |

