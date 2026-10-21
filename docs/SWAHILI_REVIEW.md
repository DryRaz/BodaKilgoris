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

Total strings: 639

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
| `common.ksh` | KSh {amount} | KSh {amount} |

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
| `client.home` | Home | Mwanzo |

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
| `ride.status.shopping` | Shopping | Anafanya manunuzi |
| `ride.status.purchased` | Shopping done | Manunuzi yamekamilika |
| `ride.status.delivering` | Delivering | Njiani kuleta |
| `ride.counted` | Counted | Imehesabiwa |
| `ride.notCounted` | Not counted | Haijahesabiwa |
| `ride.suspect` | Suspect | Ina mashaka |
| `ride.autoConfirmed` | Auto-confirmed | Imethibitishwa yenyewe |
| `ride.reason.too_fast` | Too fast (under 2 minutes) | Haraka mno (chini ya dakika 2) |
| `ride.reason.pair_frequency` | Same client and Boda: more than 10 rides in a day | Mteja na Boda yuleyule: safari zaidi ya 10 kwa siku |
| `ride.reason.problem_reported` | Problem reported by the client | Mteja ameripoti tatizo |
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
| `notify.shoppingStarted` | {name} started your shopping. | {name} ameanza manunuzi yako. |
| `notify.shoppingDone` | {name} finished the shopping. Items total: {amount}. | {name} amemaliza manunuzi. Jumla ya bidhaa: {amount}. |
| `notify.delivering` | {name} is bringing your shopping. | {name} anakuletea manunuzi. |
| `notify.deliveredConfirm` | Your shopping was delivered. Please check the receipts and confirm. | Manunuzi yako yamefikishwa. Tafadhali angalia risiti na uthibitishe. |

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
| `admin.nav.shopping` | Shopping | Manunuzi |
| `admin.nav.catalog` | Catalogue | Orodha ya bidhaa |
| `admin.nav.alerts` | Alerts | Tahadhari |
| `admin.nav.settings` | Settings | Mipangilio |
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
| `admin.rides.rideNotFound` | This order was not found. | Oda hii haikupatikana. |
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
| `admin.catalog.title` | Article catalogue | Orodha ya bidhaa |
| `admin.catalog.intro` | Clients tick articles from this list when they write a shopping list. Hiding an article only removes it from new lists: past orders keep the names they were made with. | Wateja huchagua bidhaa kutoka orodha hii wanapoandika orodha ya manunuzi. Kuficha bidhaa kunaiondoa kwenye orodha mpya tu: maagizo ya zamani hayabadiliki. |
| `admin.catalog.addTitle` | Add an article | Ongeza bidhaa |
| `admin.catalog.editTitle` | Edit this article | Badilisha bidhaa hii |
| `admin.catalog.nameEn` | Name (English) | Jina (Kiingereza) |
| `admin.catalog.nameSw` | Name (Kiswahili) | Jina (Kiswahili) |
| `admin.catalog.category` | Category | Kundi |
| `admin.catalog.unit` | Unit | Kipimo |
| `admin.catalog.unitHint` | Shown next to the quantity. | Huonyeshwa karibu na kiasi. |
| `admin.catalog.add` | Add the article | Ongeza bidhaa |
| `admin.catalog.saveChanges` | Save changes | Hifadhi mabadiliko |
| `admin.catalog.cancelEdit` | Cancel | Ghairi |
| `admin.catalog.saved` | Saved | Imehifadhiwa |
| `admin.catalog.hidden` | hidden | imefichwa |
| `admin.catalog.up` | Move up | Pandisha |
| `admin.catalog.down` | Move down | Shusha |
| `admin.catalog.edit` | Edit | Badilisha |
| `admin.catalog.hide` | Hide | Ficha |
| `admin.catalog.show` | Show again | Onyesha tena |
| `admin.shopping.title` | Shopping orders | Maagizo ya manunuzi |
| `admin.shopping.hint` | Counted separately from rides, with the same rule: an order is counted when the Boda AND the client confirm (or after 30 minutes). | Yanahesabiwa tofauti na safari, kwa kanuni ileile: agizo linahesabiwa Boda NA mteja wakithibitisha (au baada ya dakika 30). |
| `admin.shopping.today` | Today | Leo |
| `admin.shopping.week` | This week | Wiki hii |
| `admin.shopping.month` | This month | Mwezi huu |
| `admin.shopping.total` | total | jumla |
| `admin.shopping.requests` | Requests | Maombi |
| `admin.shopping.avgOrder` | Average order value | Wastani wa thamani ya agizo |
| `admin.shopping.avgFee` | Average delivery fee | Wastani wa ada ya kuleta |
| `admin.shopping.problemRate` | Problem reports | Ripoti za matatizo |
| `admin.shopping.suspect` | Suspect (month) | Yenye shaka (mwezi) |
| `admin.shopping.receiptsKept` | Orders: receipts kept | Maagizo: risiti zimehifadhiwa |
| `admin.shopping.receiptsShown` | Orders: receipts shown | Maagizo: risiti zimeonyeshwa |
| `admin.shopping.noReceiptItems` | Articles bought without receipt | Bidhaa zilizonunuliwa bila risiti |
| `admin.shopping.awaiting` | Awaiting confirmation | Zinasubiri uthibitisho |
| `admin.shopping.problemsByReason` | Problems by reason | Matatizo kwa sababu |
| `admin.shopping.topItems` | Most requested articles | Bidhaa zinazoombwa zaidi |
| `admin.shopping.topCustom` | Most frequent free-text articles | Bidhaa za kuandika zinazorudiwa zaidi |
| `admin.shopping.topCustomHint` | Good candidates to add to the catalogue. | Zinafaa kuongezwa kwenye orodha ya bidhaa. |
| `admin.shopping.noData` | No data yet. | Hakuna data bado. |
| `admin.shopping.perBoda` | Per Boda | Kwa kila Boda |
| `admin.shopping.boda` | Boda | Boda |
| `admin.shopping.orders` | Orders | Maagizo |
| `admin.shopping.counted` | Counted | Yaliyohesabiwa |
| `admin.shopping.receiptsKeptShort` | Receipts kept | Risiti zimehifadhiwa |
| `admin.shopping.receiptsShownShort` | Receipts shown | Risiti zimeonyeshwa |
| `admin.shopping.noReceiptShort` | No receipt | Bila risiti |
| `admin.shopping.problemsTitle` | Reported problems | Matatizo yaliyoripotiwa |
| `admin.shopping.noProblems` | No problem reported. | Hakuna tatizo lililoripotiwa. |
| `admin.shopping.itemsTotal` | Items total | Jumla ya bidhaa |
| `admin.shopping.fee` | Delivery fee | Ada ya kuleta |
| `admin.shopping.budget` | Budget | Bajeti |
| `admin.shopping.kept` | kept | zimehifadhiwa |
| `admin.shopping.shown` | shown | zimeonyeshwa |
| `admin.shopping.footer` | No money goes through the app: the Boda advances it and the client repays on delivery. | Hakuna pesa inayopita kwenye programu: Boda anatoa kwanza na mteja anamlipa akifikishiwa. |
| `admin.shopping.line` | {orders} orders · {counted} counted | maagizo {orders} · yaliyohesabiwa {counted} |
| `admin.shopping.receiptsLine` | receipts kept {kept}% · shown {shown}% · without receipt {none}% | risiti zimehifadhiwa {kept}% · zimeonyeshwa {shown}% · bila risiti {none}% |
| `admin.alerts.title` | Alerts | Tahadhari |
| `admin.alerts.intro` | Private to the admin. Orders are never blocked: an alert only tells you that a word from the list appeared in an order. | Ni siri ya msimamizi tu. Oda hazizuiwi kamwe: tahadhari inakuambia tu kwamba neno kutoka kwenye orodha limeonekana kwenye oda. |
| `admin.alerts.banner` | {count, plural, one {# new alert} other {# new alerts}} | {count, plural, one {Tahadhari # mpya} other {Tahadhari # mpya}} |
| `admin.alerts.toastNew` | {count, plural, one {New alert} other {# new alerts}} | {count, plural, one {Tahadhari mpya} other {Tahadhari # mpya}} |
| `admin.alerts.view.list` | Latest first | Mpya kwanza |
| `admin.alerts.view.clients` | By client | Kwa mteja |
| `admin.alerts.filterStatus` | Status | Hali |
| `admin.alerts.filterCategory` | Category | Aina |
| `admin.alerts.statusOpen` | To check | Za kuangalia |
| `admin.alerts.statusAll` | All | Zote |
| `admin.alerts.categoryAll` | All categories | Aina zote |
| `admin.alerts.status.new` | New | Mpya |
| `admin.alerts.status.seen` | Seen | Imeonekana |
| `admin.alerts.status.handled` | Handled | Imeshughulikiwa |
| `admin.alerts.status.dismissed` | Ignored | Imepuuzwa |
| `admin.alerts.category.alcohol` | Alcohol | Pombe |
| `admin.alerts.category.tobacco_drugs` | Tobacco / drugs | Tumbaku / dawa za kulevya |
| `admin.alerts.category.health` | Health | Afya |
| `admin.alerts.category.money` | Money | Pesa |
| `admin.alerts.category.danger` | Danger | Hatari |
| `admin.alerts.category.insult` | Insult | Matusi |
| `admin.alerts.typedText` | Exact text typed | Maandishi kamili yaliyoandikwa |
| `admin.alerts.whereFound` | Where | Mahali |
| `admin.alerts.inItem` | Item in the shopping list | Bidhaa kwenye orodha ya manunuzi |
| `admin.alerts.inNote` | Note to the Boda | Ujumbe kwa Boda |
| `admin.alerts.client` | Client | Mteja |
| `admin.alerts.textRemoved` | (text removed after the retention period) | (maandishi yameondolewa baada ya muda wa kuhifadhi) |
| `admin.alerts.recurrence` | {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} {category} alert in 30 days | Tahadhari ya {n} ya {category} ndani ya siku 30 |
| `admin.alerts.call` | Call | Piga simu |
| `admin.alerts.whatsapp` | WhatsApp | WhatsApp |
| `admin.alerts.openOrder` | Open the order | Fungua oda |
| `admin.alerts.privateNote` | Private note (only you see it) | Maelezo ya siri (wewe tu unaona) |
| `admin.alerts.actions.seen` | Seen | Nimeona |
| `admin.alerts.actions.handled` | Handled | Imeshughulikiwa |
| `admin.alerts.actions.dismissed` | Ignore | Puuza |
| `admin.alerts.actions.saveNote` | Save note | Hifadhi maelezo |
| `admin.alerts.saved` | Saved | Imehifadhiwa |
| `admin.alerts.empty` | No alerts here. | Hakuna tahadhari hapa. |
| `admin.alerts.loadFailed` | Could not load the alerts. Check the connection and try again. | Imeshindwa kupakia tahadhari. Angalia mtandao ujaribu tena. |
| `admin.alerts.newCount` | {count} new | {count} mpya |
| `admin.alerts.lastAlert` | Last alert: {when} | Tahadhari ya mwisho: {when} |
| `admin.settings.title` | Alert settings | Mipangilio ya tahadhari |
| `admin.settings.intro` | Choose which words raise a private alert. This never stops or changes an order. | Chagua maneno yanayotoa tahadhari ya siri. Hii haizuii wala kubadilisha oda yoyote. |
| `admin.settings.master` | Alerts | Tahadhari |
| `admin.settings.masterOn` | On: matching orders create an alert. | Imewashwa: oda zenye neno la orodha zinatoa tahadhari. |
| `admin.settings.masterOff` | Off: no alert is created at all. | Imezimwa: hakuna tahadhari inayotolewa kabisa. |
| `admin.settings.last30` | {count} in the last 30 days | {count} ndani ya siku 30 zilizopita |
| `admin.settings.saved` | Saved | Imehifadhiwa |
| `admin.settings.loadFailed` | Could not load the settings. Try again. | Imeshindwa kupakia mipangilio. Jaribu tena. |
| `admin.settings.testTitle` | Test a text | Jaribu maandishi |
| `admin.settings.testLabel` | Text to test | Maandishi ya kujaribu |
| `admin.settings.testPlaceholder` | e.g. 2 bottles of Tusker | mfano: chupa 2 za Tusker |
| `admin.settings.testButton` | Test | Jaribu |
| `admin.settings.testWould` | This text WOULD raise an alert. | Maandishi haya YATATOA tahadhari. |
| `admin.settings.testMatchOff` | A word matches but its alert is switched off: no alert. | Neno linalingana lakini tahadhari yake imezimwa: hakuna tahadhari. |
| `admin.settings.testNone` | No word from the list matches: no alert. | Hakuna neno la orodha linalolingana: hakuna tahadhari. |
| `admin.settings.wouldAlert` | alert | tahadhari |
| `admin.settings.reasonMaster` | alerts are off | tahadhari zimezimwa |
| `admin.settings.reasonCategory` | category is off | aina imezimwa |
| `admin.settings.reasonTerm` | this word is off | neno hili limezimwa |
| `admin.settings.reasonInactive` | this word is removed | neno hili limeondolewa |
| `admin.settings.addTitle` | Add a word | Ongeza neno |
| `admin.settings.termLabel` | Word or short phrase | Neno au kifungu kifupi |
| `admin.settings.categoryLabel` | Category | Aina |
| `admin.settings.alertOnLabel` | Raise an alert for this word | Toa tahadhari kwa neno hili |
| `admin.settings.add` | Add | Ongeza |
| `admin.settings.termAdded` | Word added | Neno limeongezwa |
| `admin.settings.termsTitle` | Words | Maneno |
| `admin.settings.termsHint` | Whole words only: "gin" matches "gin" but not "ginger". Switch a word off to stop its alerts. | Neno kamili tu: "gin" inalingana na "gin" lakini si "ginger". Zima neno ili kuacha tahadhari zake. |
| `admin.settings.remove` | Remove | Ondoa |
| `admin.settings.restore` | Restore | Rudisha |
| `admin.settings.retentionTitle` | Retention | Muda wa kuhifadhi |
| `admin.settings.retentionHint` | Handled or ignored alerts older than this are deleted. Old open alerts lose their text and note. Counters are kept. | Tahadhari zilizoshughulikiwa au kupuuzwa zaidi ya muda huu zinafutwa. Tahadhari wazi za zamani zinapoteza maandishi na maelezo. Hesabu zinabaki. |
| `admin.settings.retentionLabel` | Days | Siku |
| `admin.settings.save` | Save | Hifadhi |

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
| `errors.empty_list` | Add at least one article to your list. | Weka angalau bidhaa moja kwenye orodha yako. |
| `errors.too_many_items` | The list is too long (60 items maximum). | Orodha ni ndefu mno (bidhaa 60 kwa kiwango cha juu). |
| `errors.invalid_item` | One of the articles is not valid. Please check your list. | Moja ya bidhaa si sahihi. Tafadhali angalia orodha yako. |
| `errors.invalid_amount` | Please enter a valid amount. | Tafadhali weka kiasi sahihi. |
| `errors.receipts_required` | Please tick the receipts box first. | Tafadhali weka tiki kwenye kisanduku cha risiti kwanza. |
| `errors.item_not_found` | This item was not found. | Bidhaa hii haikupatikana. |
| `errors.invalid_problem` | Please choose a reason. | Tafadhali chagua sababu. |
| `errors.already_reported` | A problem was already reported for this order. | Tatizo tayari liliripotiwa kwa agizo hili. |
| `errors.invalid_term` | Enter a word of at most 60 characters and choose a category. | Andika neno lisilozidi herufi 60 na uchague aina. |
| `errors.term_exists` | This word is already in the list. | Neno hili tayari liko kwenye orodha. |
| `errors.invalid_setting` | This value is not valid. | Thamani hii si sahihi. |
| `errors.invalid_alert` | This alert status is not valid. | Hali hii ya tahadhari si sahihi. |

## shopping

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `shopping.homeTitle` | What do you need? | Unahitaji nini? |
| `shopping.rideTitle` | Ride | Safari |
| `shopping.rideHint` | A Boda takes you somewhere | Boda anakupeleka mahali |
| `shopping.shoppingTitle` | Shopping list | Orodha ya manunuzi |
| `shopping.shoppingHint` | A Boda buys and brings it to your door | Boda ananunua na kukuletea nyumbani |
| `shopping.resume` | Continue my list ({count}) | Endelea na orodha yangu ({count}) |
| `shopping.home` | Home | Mwanzo |
| `shopping.stepOf` | Step {step} of 3 | Hatua {step} kati ya 3 |
| `shopping.listTitle` | Your shopping list | Orodha yako ya manunuzi |
| `shopping.searchPlaceholder` | Search an article… | Tafuta bidhaa… |
| `shopping.categories.staples` | Basic food | Chakula cha msingi |
| `shopping.categories.fresh` | Fresh food | Vyakula vibichi |
| `shopping.categories.home` | Home | Nyumbani |
| `shopping.categories.energy` | Energy | Nishati |
| `shopping.categories.misc` | Other | Mengineyo |
| `shopping.units.kg` | kg | kg |
| `shopping.units.litre` | litre | lita |
| `shopping.units.piece` | piece | kipande |
| `shopping.units.packet` | packet | pakiti |
| `shopping.units.sachet` | sachet | sacheti |
| `shopping.units.bunch` | bunch | fungu |
| `shopping.units.ksh` | KSh | KSh |
| `shopping.noMatch` | No article found. Add it below as “Other item”. | Hakuna bidhaa iliyopatikana. Iweke hapa chini kama “Bidhaa nyingine”. |
| `shopping.less` | Less | Punguza |
| `shopping.more` | More | Ongeza |
| `shopping.otherTitle` | Other item | Bidhaa nyingine |
| `shopping.otherPlaceholder` | Example: 2 packets of Krackers biscuits | Mfano: pakiti 2 za biskuti za Krackers |
| `shopping.addItem` | Add | Ongeza |
| `shopping.otherHint` | Write anything you need, with the quantity if you want. | Andika kitu chochote unachohitaji, pamoja na kiasi ukipenda. |
| `shopping.remove` | Remove | Ondoa |
| `shopping.itemsCount` | {count, plural, =0 {No item} one {# item} other {# items}} | {count, plural, =0 {Hakuna bidhaa} one {Bidhaa #} other {Bidhaa #}} |
| `shopping.checkList` | Check my list | Angalia orodha yangu |
| `shopping.emptyList` | Add at least one article. | Weka angalau bidhaa moja. |
| `shopping.startOver` | Clear the list and start over | Futa orodha na uanze upya |
| `shopping.reviewTitle` | Check your list | Angalia orodha yako |
| `shopping.addMore` | Add more articles | Ongeza bidhaa zaidi |
| `shopping.budgetLabel` | Maximum budget (KSh), optional | Bajeti ya juu (KSh), si lazima |
| `shopping.budgetHint` | The Boda will try to stay under this amount. | Boda atajaribu kutozidi kiasi hiki. |
| `shopping.noteLabel` | Note for the Boda, optional | Ujumbe kwa Boda, si lazima |
| `shopping.notePlaceholder` | Preferred brand, preferred shop… | Chapa unayopendelea, duka unalopendelea… |
| `shopping.payNotice` | The Boda advances the money for the shopping. You repay him on delivery, on presentation of the receipts. The app does not handle money. | Boda anatoa pesa za manunuzi kwanza. Unamlipa akikuletea, baada ya kukuonyesha risiti. Programu hii haishughulikii pesa. |
| `shopping.chooseBoda` | Choose a Boda | Chagua Boda |
| `shopping.yourList` | {count, plural, one {Your list: # item} other {Your list: # items}} | {count, plural, one {Orodha yako: bidhaa #} other {Orodha yako: bidhaa #}} |
| `shopping.editList` | Edit | Badilisha |
| `shopping.sendList` | Send the list | Tuma orodha |
| `shopping.tapMapDelivery` | Tap the map to place the delivery pin. | Gusa ramani kuweka alama ya mahali pa kupelekewa. |
| `shopping.gpsFallbackDelivery` | We could not get your GPS position. Tap the map to place the delivery pin. | Hatukuweza kupata mahali ulipo kwa GPS. Gusa ramani kuweka alama ya mahali pa kupelekewa. |
| `shopping.landmarkLabel` | Delivery landmark (optional) | Alama ya mahali pa kupelekewa (si lazima) |
| `shopping.landmarkHint` | Helps the Boda find your door. | Inamsaidia Boda kupata nyumbani kwako. |
| `shopping.landmarkPlaceholder` | Example: green gate, behind X school | Mfano: lango la kijani, nyuma ya shule ya X |
| `shopping.order.accepted` | {name} accepted your list | {name} amekubali orodha yako |
| `shopping.order.shopping` | {name} is doing your shopping | {name} anafanya manunuzi yako |
| `shopping.order.purchased` | {name} finished the shopping | {name} amemaliza manunuzi |
| `shopping.order.delivering` | {name} is bringing your shopping | {name} anakuletea manunuzi |
| `shopping.order.completed` | {name} delivered your shopping | {name} amekuletea manunuzi yako |
| `shopping.steps.accepted` | Accepted | Amekubali |
| `shopping.steps.shopping` | Shopping | Anafanya manunuzi |
| `shopping.steps.purchased` | Shopping done | Manunuzi yamekamilika |
| `shopping.steps.delivering` | On the way | Njiani |
| `shopping.steps.completed` | Delivered | Imefikishwa |
| `shopping.itemStatus.pending` | To buy | Bado |
| `shopping.itemStatus.bought` | Bought | Imenunuliwa |
| `shopping.itemStatus.not_found` | Not found | Haipatikani |
| `shopping.itemStatus.replaced` | Replaced | Imebadilishwa |
| `shopping.noReceipt` | No receipt | Hakuna risiti |
| `shopping.itemsTotal` | Items total: {amount} | Jumla ya bidhaa: {amount} |
| `shopping.repayNotice` | You repay the Boda on delivery, after checking the receipts. Nothing is paid in the app. | Unamlipa Boda akikuletea, baada ya kuangalia risiti. Hakuna malipo kwenye programu. |
| `shopping.overBudget` | This is above your maximum budget ({budget}). | Hii ni zaidi ya bajeti yako ya juu ({budget}). |
| `shopping.budgetShort` | Max budget: {amount} | Bajeti ya juu: {amount} |
| `shopping.deliveredTitle` | Delivery done | Manunuzi yamefikishwa |
| `shopping.receiptsNotice` | Your Boda must show you the receipts. Check them against the list and the total before confirming. | Boda wako lazima akuonyeshe risiti. Zilinganishe na orodha na jumla kabla ya kuthibitisha. |
| `shopping.itemsTotalLabel` | Items total | Jumla ya bidhaa |
| `shopping.deliveryFee` | Delivery fee | Ada ya kuleta |
| `shopping.totalToRepay` | To repay the Boda | Ya kumlipa Boda |
| `shopping.rateTitle` | How was it? | Ilikuwaje? |
| `shopping.rateOptional` | Rating is optional | Kupima ni hiari |
| `shopping.confirmDelivery` | Confirm the delivery | Thibitisha uwasilishaji |
| `shopping.reportProblem` | Report a problem | Ripoti tatizo |
| `shopping.deliveryThanks` | Thank you! The delivery is confirmed. | Asante! Uwasilishaji umethibitishwa. |
| `shopping.problemTitle` | What is the problem? | Tatizo ni nini? |
| `shopping.problems.receipts_not_shown` | Receipts not shown | Risiti hazikuonyeshwa |
| `shopping.problems.total_mismatch` | Total different from the receipts | Jumla ni tofauti na risiti |
| `shopping.problems.missing_item` | Missing item | Bidhaa haipo |
| `shopping.problems.other` | Other | Nyingine |
| `shopping.problemDetails` | Tell us more (optional) | Tueleze zaidi (si lazima) |
| `shopping.cancelReport` | Back | Rudi |
| `shopping.sendReport` | Send the report | Tuma ripoti |
| `shopping.problemSent` | Your report was sent. Thank you. | Ripoti yako imetumwa. Asante. |
| `shopping.loadFailed` | Could not load the articles, please try again. | Imeshindikana kupakia bidhaa, tafadhali jaribu tena. |
| `shopping.loadFailedHint` | You can still write your own articles in “Other item” below. | Bado unaweza kuandika bidhaa zako mwenyewe kwenye “Bidhaa nyingine” hapa chini. |
| `shopping.retry` | Try again | Jaribu tena |

## shoppingBoda

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `shoppingBoda.badge` | Shopping | Manunuzi |
| `shoppingBoda.itemsCount` | {count, plural, one {# item} other {# items}} | {count, plural, one {Bidhaa #} other {Bidhaa #}} |
| `shoppingBoda.budget` | Max budget: {amount} | Bajeti ya juu: {amount} |
| `shoppingBoda.noBudget` | No budget given | Hakuna bajeti |
| `shoppingBoda.landmark` | Delivery landmark | Alama ya mahali pa kupeleka |
| `shoppingBoda.note` | Note | Ujumbe |
| `shoppingBoda.deliveryPoint` | Delivery point | Mahali pa kupeleka |
| `shoppingBoda.advanceNotice` | You advance the money. The client repays you on delivery. Keep ALL the receipts. | Unatoa pesa kwanza. Mteja anakulipa ukimfikishia. Weka risiti ZOTE. |
| `shoppingBoda.receiptsBanner` | Keep ALL the invoices and receipts from the shops. Show them to the client at delivery. | Weka ankara na risiti ZOTE za maduka. Zionyeshe kwa mteja unapomfikishia. |
| `shoppingBoda.call` | Call | Piga simu |
| `shoppingBoda.whatsapp` | WhatsApp | WhatsApp |
| `shoppingBoda.budgetLabel` | Max budget | Bajeti ya juu |
| `shoppingBoda.itemsTotal` | Items total | Jumla ya bidhaa |
| `shoppingBoda.listTitle` | Items ({done}/{count} marked) | Bidhaa ({done}/{count} zimewekewa alama) |
| `shoppingBoda.startToTick` | Press “I’m shopping” to start marking the items. | Bonyeza “Ninafanya manunuzi” kuanza kuweka alama kwenye bidhaa. |
| `shoppingBoda.bought` | Bought | Imenunuliwa |
| `shoppingBoda.notFound` | Not found | Haipatikani |
| `shoppingBoda.replacement` | Replacement | Mbadala |
| `shoppingBoda.replacementPlaceholder` | Replacement (optional) | Mbadala (si lazima) |
| `shoppingBoda.saveReplacement` | OK | Sawa |
| `shoppingBoda.noReceipt` | No receipt | Hakuna risiti |
| `shoppingBoda.btnShopping` | I’m shopping | Ninafanya manunuzi |
| `shoppingBoda.btnPurchased` | Shopping done | Manunuzi yamekamilika |
| `shoppingBoda.btnDelivering` | On my way to the client | Niko njiani kwa mteja |
| `shoppingBoda.btnDelivered` | Delivered | Imefikishwa |
| `shoppingBoda.itemsTotalInput` | Total of the items (KSh) | Jumla ya bidhaa (KSh) |
| `shoppingBoda.stillPending` | {count, plural, one {# item is still not marked.} other {# items are still not marked.}} | {count, plural, one {Bidhaa # bado haijawekewa alama.} other {Bidhaa # bado hazijawekewa alama.}} |
| `shoppingBoda.receiptsKept` | I kept all the receipts | Nimehifadhi risiti zote |
| `shoppingBoda.purchasedNeeds` | Enter the total and tick “I kept all the receipts”. | Weka jumla na uweke tiki kwenye “Nimehifadhi risiti zote”. |
| `shoppingBoda.deliveryFeeInput` | Delivery fee (KSh) | Ada ya kuleta (KSh) |
| `shoppingBoda.receiptsShown` | I showed the receipts to the client | Nimemwonyesha mteja risiti |
| `shoppingBoda.deliveredNeeds` | Enter the delivery fee and tick “I showed the receipts to the client”. | Weka ada ya kuleta na uweke tiki kwenye “Nimemwonyesha mteja risiti”. |

## privacy

| Key | English | Kiswahili (à relire) |
|---|---|---|
| `privacy.title` | Privacy | Faragha |
| `privacy.notice` | The app team can view the content of orders, in particular for safety, to follow the service, and to offer you support if you wish. | Timu ya programu inaweza kuona maelezo ya oda, hasa kwa usalama, kufuatilia huduma, na kukupa msaada ukitaka. |
| `privacy.more` | Your phone number and your orders are never shared with other people or companies. | Namba yako ya simu na oda zako hazitolewi kamwe kwa watu au kampuni nyingine. |
| `privacy.understood` | I understand | Nimeelewa |
| `privacy.close` | Close | Funga |
| `privacy.link` | Privacy | Faragha |

