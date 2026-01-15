import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, 
    getDocs, updateDoc, deleteField, collection,
    arrayUnion, arrayRemove, serverTimestamp,
    query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);  

// const myMail = localStorage['ak-muijemuije24@gmail.com'];
// const unsub = onSnapshot(doc(db, 'locationsData', `user-${myMail}`), (doc) => {
//   const source = doc.metadata.hasPendingWrites ? "Local" : "Server";
//   console.log(source, " data: ", doc.data());
// });

// const unsub2 = onSnapshot(doc(db, 'locationsData', `user-${myMail}`), (doc) => {
//     console.log("Current data:: ", doc.data());
// });

/*const q = query(collection(db, "cities"), where("state", "==", "CA"));
const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
        console.log("New city: ", change.doc.data());
    }
    if (change.type === "modified") {
        console.log("Modified city: ", change.doc.data());
    }
    if (change.type === "removed") {
        console.log("Removed city: ", change.doc.data());
    }
  });
});*/

let map;
let infoWindow;
let placesService;
let diningMarkers = []; // Array to store dining markers for cleanup

const locationNYC = { lat: 40.7580, lng: -73.9855 };
const markerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/677cc99549bcbb38edad633e_pin24.png';
const hotelMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879b831dec5947617d34e3__hotel.png';
const airportMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879bb7f77423763223d449__airport.png';
const cameraPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6c29e5f2d2eb42bffc_cam.png';
const foodForkPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6ccc71c7d26c3f411c_rest.png';
const busPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c734dec75c736ea75eaa_bus.png';
const trainPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c7346b2a3e350322617a_train.png';
const trainSteamPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c7349ad647a000575132_train-steam.png';
const directionsUrlBase = 'https://www.google.com/maps/search/';
const mapFetchFields = ['displayName', 'location', 'editorialSummary', 'formattedAddress', 'photos', 'rating', 'reviews'];
// const $timeslots = document.querySelectorAll('[data-ak-timeslots]');
const $titleInfoSkeletonWrap = document.querySelector('.ak-skeleton-wrap');
const $tripTitleInfo = document.querySelector('.ak-trip-info');
const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');
const $saveItineraryBtn = document.querySelector('[data-ak="save-itinerary"]');
const $unsavedChanges = document.querySelector('[data-ak="slider-locations-changes"]');
const $mapPinsRadios = document.querySelectorAll('.ak-map-pins-wrap input[type=radio]');
const $sliderArrows = document.querySelectorAll('.w-slider-arrow-left, .w-slider-arrow-right');
const currentPage = window.location.pathname || '/customize-itinerary';

// const markerArr = [];
const markerObj = {};
            
const locations = {
  new_york: { lat: 40.7580, lng: -73.9855 },
  washington_dc: { lat: 38.89511, lng: -77.03637 },
  los_angeles: { lat: 34.052235, lng: -118.243683 },
  las_vegas: { lat: 36.175, lng: -115.136 },
  miami: { lat: 25.7743, lng: -80.1937 },
};

let mapCenter = locationNYC;
if (localStorage['ak-user-destination']) {
  const locationName = localStorage['ak-user-destination']; 
  mapCenter = locations[locationName];
}

initMap(mapCenter);
async function initMap(center) {
  const $map = document.querySelector('.map');
  const { Map, InfoWindow  } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const { Place } = await google.maps.importLibrary('places');
  map = new google.maps.Map($map, {
    zoom: 12,
    center,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  }); 

  infoWindow = new InfoWindow();

  const $toggleTransitWrap = document.querySelector('.ak-toggle-wrap.dining');
  $toggleTransitWrap.addEventListener('click', async e => {
    if (!e.target.classList.contains('ak-toggle')) return;
    if (!e.target.classList.contains('dining')) return;

    toggleNewPlacesLayer(['restaurant'], diningMarkers); //, 'showDiningButton');
  }); 

  /*document.getElementById('.ak-toggle').addEventListener('click', () => {
    // Pass 'restaurant' as the primary type
    toggleNewPlacesLayer('restaurant', diningMarkers, 'showDiningButton');
  });*/

  // directionsService = new DirectionsService();
  // directionsRenderer = new DirectionsRenderer();
  // directionsRenderer.setMap(map); // Attach the renderer to your map

  return map;
}

/** * Toggles the new Places API v2 search 
 */
async function toggleNewPlacesLayer(type, markerArray){ //, buttonId) {
  // const button = document.getElementById(buttonId);

  if (markerArray.length > 0) {
    clearMarkers(markerArray);
    // button.textContent = `Show Dining`;
  } else {
    // button.textContent = `Loading...`;
    console.log('type::', type)
    console.log('markerArray::', markerArray)
    // await showNewPlacesLayer(['restaurant'], markerArray);
    
    const center = map.getBounds().getCenter();
    const lat = center.lat();
    const lng = center.lng();

    searchForNearbyPlaces(lat, lng); 
    // button.textContent = `Hide Dining`;
  }
}

/**
 * Modern searchNearby implementation
 */
async function showNewPlacesLayer(type, markerArray) {
  const { Place } = await google.maps.importLibrary('places');

  // 1. Get the current bounds from the map
  const currentBounds = map.getBounds();

  console.log('currentBounds::', currentBounds)

  // 2. Safety Check: If the map isn't fully loaded, bounds might be undefined
  if (!currentBounds) {
    console.warn("Map bounds not available yet. Wait for 'idle' or 'tilesloaded' event.");
    return;
  }

  const formalBounds = new google.maps.LatLngBounds(
    currentBounds.getSouthWest(),
    currentBounds.getNorthEast()
  );

  const center = map.getCenter();

  // Define the request using the map's current view
  const request = {
    includedPrimaryTypes: ['restaurant'], // type, // e.g., ['restaurant']
    // locationRestriction: formalBounds, // locationRestriction: map.getBounds(), // Search only what's visible
    // locationRestriction: {
    //   rectangle: currentBounds 
    // },
    /*locationRestriction: {
      circle: {
        center: {
          latitude: center.lat(),
          longitude: center.lng(),
        },
        radius: Number(2500), // meters
      },
    },*/
    "locationRestriction": {
      "circle": {
        "center": {
          "latitude": 37.7937,
          "longitude": -122.3965
        },
        "radius": 500.0
      }
    }, 
    maxResultCount: 20,
    fields: ['displayName', 'location', 'rating', 'id', 'businessStatus'],
  };

  try {
    // ✨ The new way to search
    const { places } = await Place.searchNearby(request);

    if (places && places.length > 0) {
      places.forEach((place) => {
        const marker = createPlaceMarker(place);
        markerArray.push(marker);
      });
    }
  } catch (error) {
    console.error("Search failed:", error);
  }
}

function createPlaceMarker(place) {
  const markerIcon = document.createElement('div');
  markerIcon.className = `custom-marker ${category}-marker`;
  
  // Assign icons based on category
  const icons = {
    restaurant: '🍽️',
    shopping_mall: '🛍️',
    tourist_attraction: '🏛️'
  };
  markerIcon.textContent = icons[place.primaryType] || '📍';

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map: map,
    position: place.location, // In v2, it's .location, not .geometry.location
    title: place.displayName, // In v2, it's .displayName
    content: markerIcon,
  });

  marker.addListener('click', () => {
    // You can fetch more details if needed, but display name is usually enough for a quick look
    infoWindow.setContent(`
      <div style="padding:10px;">
        <strong>${place.displayName}</strong><br>
        Rating: ${place.rating ? place.rating : 'N/A'} ⭐
      </div>
    `);
    infoWindow.open(map, marker);
  });

  return marker;
}

async function searchForNearbyPlaces(
                                    latitude, 
                                    longitude, 
                                    radius=500.0, 
                                    maxResultCount=10, 
                                    includedTypes=['restaurant']
                                ) {
    const nearbySearchUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const key = 'AIzaSyCMmi6kGAOGfMzK4CBvNiVBB7T6OjGbsU4'; // 'AIzaSyDM7Sbx3ogbiG0l_c-j7PJk4m1ivbddY4I';
    const payload = {
        includedTypes,
        maxResultCount,
        locationRestriction: {
            circle: {
                center: {
                    latitude,
                    longitude,
                },
                radius,
            }
        }           
    };

    const fieldMask = 'places.location,places.displayName'; //,places.delivery,places.dineIn,places.takeout,places.websiteUri,places.rating,places.restroom,places.reviews,places.priceRange,places.priceLevel,places.parkingOptions,places.outdoorSeating,places.allowsDogs,places.businessStatus,places.currentOpeningHours';

    const res = await fetch(nearbySearchUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    const { places } = data;

    console.log(places)

    places.forEach(place => {
        const { displayName: { text:title }, location: { latitude:lat, longitude:lng } } = place;
        const position = { lat, lng };
        // createMarker(title, position);
        createPlaceMarker(place);
        map.setCenter(position);
        map.setZoom(15);
    });
}

function createMarker(title, position) {
    const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title,
        gmpClickable: true,
    });

    marker.addListener('gmp-click', ({ domEvent, latLng }) => {
        // const { target } = domEvent;
        
        infoWindow.close();
        infoWindow.setContent(marker.title);
        infoWindow.open(marker.map, marker);
    });
}







window.addEventListener('load', async () => {

const $toggleTransitWrap = document.querySelector('.ak-toggle-wrap.transit');
$toggleTransitWrap.addEventListener('click', async e => {
  if (!e.target.classList.contains('ak-toggle')) return;
  if (!e.target.classList.contains('transit')) return;
  $toggleTransitWrap.n = ($toggleTransitWrap.n || 0) + 1;
  
  if ($toggleTransitWrap.n % 2 === 0) {
    await initMap(mapCenter);
  }
  else {
    const map = await initMap(mapCenter);
    addTransitLayer(map); 
  }

  const checkedVal = document.querySelector('[name="View-Map-Pins"]:checked')?.value;
  showHidePins(checkedVal);
});

function addTransitLayer(map) {
  // 🚆 Show all transit routes and stations as a background layer
  const transitLayer = new google.maps.TransitLayer();
  transitLayer.setMap(map);
}


  await Clerk.load();

  const attractionslimit = 5;
  let addedAttractions = localStorage['ak-addedAttractions-count'] 
                       ? Number(localStorage['ak-addedAttractions-count']) 
                       : 0;

  updateSavedChangesFlag();
  hideShowLoginNSavebtn();

  function updateSavedChangesFlag() {
    if (localStorage['ak-unsaved-changes']) {
      setUnsavedChangesFlag();
    }
  }

  function hideShowLoginNSavebtn() {
    const $loginBtn = document.querySelector('[data-ak="clerk-login"]');
    const $saveBtn = document.querySelector('[data-ak="save-itinerary"]');
    const $loginToPrintItineraryBtn = document.querySelector('[data-ak="login-to-get-text-file"]');
    const $printItineraryBtn = document.querySelector('[data-ak="generate-text-file"]');

    if (Clerk.user) {
      $saveBtn.closest('.ak-save-wrap').classList.remove('hidden');
      processPrintItinerary();
    }
    else {
      processLoginBtn();
      processLoginToPrint();
    }

    function processLoginToPrint() {
      $loginToPrintItineraryBtn.removeAttribute('data-ak-hidden');
      $loginToPrintItineraryBtn.addEventListener('click', e => {
        if (!Clerk.user) {
          Clerk.openSignUp({
            redirectUrl: currentPage,
          });
        }
      });
    }

    function processPrintItinerary() {
      $printItineraryBtn.removeAttribute('data-ak-hidden');
      $printItineraryBtn.addEventListener('click', e => {
        const userMail = localStorage['ak-userMail'];
        let userId;
        if (userMail) userId = encodeURIComponent(userMail);
        window.location.href = `/itinerary-list?id=${userId || ''}`;
      });
    }

    function processLoginBtn() {
      $loginBtn.classList.remove('hidden');
      $loginBtn.addEventListener('click', e => {
        if (!Clerk.user) {
          Clerk.openSignUp({
            redirectUrl: currentPage,
          });
        }
      });
    }
  }

  if (Clerk.user) { // logged-in user retrieve from DB
    console.log('Logged-in')

    // Remove attractions counter
    // It's only used for non-logged in users
    localStorage.removeItem('ak-addedAttractions-count'); 

    const userMail = localStorage['ak-userMail']; // this is set in webflow site settings once user logs-in
    const data = await retrieveDBData(userMail); 
    
    if (!data) {  // user has no saved record in the db
      handleUserNotSavedInDB();
      createUserInFirebase(userMail);

      // Get any previously stored data in the localStorage
      // This is in cases where the user began interacting
      // with the tool before logging in to save
      const savedAttractions = localStorage['ak-attractions-saved'];
      const tripName = Clerk?.user?.externalAccounts?.[0]?.firstName || '';
      const travelDates = localStorage['ak-travel-days'];

      const hotel = localStorage['ak-hotel'];
      const arrivalAirport = localStorage['ak-arrival-airport'];
      const departureAirport = localStorage['ak-departure-airport'];

      setupUserInfo(savedAttractions, tripName, travelDates, hotel, arrivalAirport, departureAirport);

      await saveAttractionsDB();
      removeUnsavedChangesFlag(); 

      function handleUserNotSavedInDB() {
        console.log('::::Found no data --- Absolutely new user!')

        // remove travel-days in case someone else had logged in with other account & selected dates
        // username & email already removed every time a user logs out in site settings
        // travel-days can't be removed on log-out to accommodate non-logged in users
        // ....
        // 'ak-update-travel-days' shows user has just selected dates from /free-trip-planner page
        if (!localStorage['ak-update-travel-days']) {
          localStorage.removeItem('ak-travel-days'); 
        }

        if (localStorage['ak-referred']) {
          handleReferredUserNotSavedInDB();
          return;
        }

        showTripInfoHeader(); 
        // redirectToPlannerPage();

        function handleReferredUserNotSavedInDB() {
          localStorage.removeItem('ak-referred');
          console.log('::::No data but ak-referred found')
          showErrorAlertNRedirect(userMail); 
        }
      }
    }
    else {
      const { referrerMail } = data;
      if (referrerMail) {
        console.log('Referred user!')

        if (localStorage['ak-update-merge-local']) {
          localStorage['ak-update-merge-db'] = true;
        }

        localStorage['ak-referrer-mail'] = referrerMail;

        const referrerData = await retrieveReferrerData(referrerMail);

        const { 
          tripName, 
          travelDates, 
          hotel, 
          arrivalAirport, 
          departureAirport, 
          savedAttractions, 
        } = referrerData;

        console.log('tripName', tripName) 

        const {
          userTravelDates, 
          userHotel, 
          userArrivalAirport, 
          userDepartureAirport, 
          userAttractions
        } = processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions);   

        localStorage['ak-hotel'] = userHotel;
        localStorage['ak-arrival-airport'] = userArrivalAirport;
        localStorage['ak-departure-airport'] = userDepartureAirport;
              
        setupUserInfo(userAttractions, tripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);
        localStorage.removeItem('ak-referred');

        handleSeverTiesToReferrer();
        // handleSelectPlanToView();
      }
      else {

        if (!referrerMail && localStorage['ak-referred']) {
          console.log('Referred user but not connected to any plan!')

          localStorage.removeItem('ak-referred');

          const name = localStorage['ak-user-name'] ? localStorage['ak-user-name'].split(/\s+/)[0] : '';
          const displayMsg = `${name ? `Hi ${name}\n` : ''}The email address: ${userMail}\nis not connected to another plan\nHere's your current plan`;
          alert(displayMsg);
        }

        console.log('Regular user!')

        if (localStorage['ak-update-merge-local']) {
          localStorage['ak-update-merge-db'] = true;
        }
        
        const { 
          tripName, 
          travelDates, 
          hotel, 
          arrivalAirport, 
          departureAirport, 
          savedAttractions, 
        } = data;

        const userName = Clerk?.user?.externalAccounts?.[0]?.firstName;
        const userTripName = tripName ? tripName : userName;

        // localStorage['sample-saved'] = savedAttractions;

        const {
          userTravelDates, 
          userHotel, 
          userArrivalAirport, 
          userDepartureAirport, 
          userAttractions
        } = processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions);   

        localStorage['ak-hotel'] = userHotel;
        localStorage['ak-arrival-airport'] = userArrivalAirport;
        localStorage['ak-departure-airport'] = userDepartureAirport;

        setupUserInfo(userAttractions, userTripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);
      }
    }
  }  
  // end of logged-in user code
  else if (localStorage['ak-attractions-saved']) { // unlogged-in user retrieve from cache
    const savedAttractions = localStorage['ak-attractions-saved'];

    console.log('Logged out user')

    const travelDates = localStorage['ak-travel-days'];

    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];

    setupUserInfo(savedAttractions, undefined, travelDates, hotel, arrivalAirport, departureAirport);
    localStorage['ak-update-merge-local'] = true;
  }
  else {
    const travelDates = localStorage['ak-travel-days'];

    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];
    setupUserInfo(undefined, undefined, travelDates, hotel, arrivalAirport, departureAirport);
    
    showTripInfoHeader(); 
  }

  function processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions) {
    let userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions;
    if (localStorage['ak-update-travel-days']) {
      userTravelDates = localStorage['ak-travel-days'];
    }
    else {
      userTravelDates = travelDates;
    }

    if (localStorage['ak-update-hotel']) {
      userHotel = localStorage['ak-hotel'];
    }
    else {
      userHotel = hotel;
    }

    if (localStorage['ak-update-arrival-airport']) {
      userArrivalAirport = localStorage['ak-arrival-airport'];
    }
    else {
      userArrivalAirport = arrivalAirport;
    }

    if (localStorage['ak-update-departure-airport']) {
      userDepartureAirport = localStorage['ak-departure-airport'];
    }
    else {
      userDepartureAirport = departureAirport;
    }

    if (localStorage['ak-update-attractions']) {
      if (localStorage['ak-update-merge-local'] && localStorage['ak-update-merge-db']) {
        mergelocalNDBAttractions(savedAttractions); 
      }
      userAttractions = localStorage['ak-attractions-saved'];
    }
    else {
      userAttractions = savedAttractions;
    }
    
    return { userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions };
  }

  function mergelocalNDBAttractions(savedAttractionsDB) {
    const localSavedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
    const savedAttractions = JSON.parse(savedAttractionsDB); 
    for (const [slide, attractions] of Object.entries(savedAttractions)) {
        if (slide !== 'slide1' && slide !== 'slide2') continue;
    
        const { morning: savedMorningArr, afternoon: savedAfternoonArr, evening: savedEveningArr } = attractions;
        const { morning: localMorningArr, afternoon: localAfternoonArr, evening: localEveningArr } = localSavedAttractions[slide];
        
        savedAttractions[slide].morning = [...savedMorningArr, ...localMorningArr];
        savedAttractions[slide].afternoon = [...savedAfternoonArr, ...localAfternoonArr];
        savedAttractions[slide].evening = [...savedEveningArr, ...localEveningArr];
    }
    
    console.log('localSavedAttractions::', localSavedAttractions)
    console.log('savedAttractions::', savedAttractions)
    console.log('After merge::', savedAttractions)

    localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
    localStorage.removeItem('ak-update-merge-local');
    localStorage.removeItem('ak-update-merge-db');
  }

  const $secondaryEmailWrap = document.querySelector('[data-ak="add-secondary-email-section"]');
  if (Clerk.user && !localStorage['ak-referrer-mail']) {
    $secondaryEmailWrap?.removeAttribute('data-ak-hidden');
  }

  function showErrorAlertNRedirect(userMail) {
    displayErrMsg(userMail);
    redirectToPlannerPage();
  }

  function displayErrMsg(userMail) {
    const name = localStorage['ak-user-name'] ? localStorage['ak-user-name'].split(/\s+/)[0] : '';
    const displayMsg = `${name ? `Hi ${name}\n` : ''}The email address: ${userMail}\nis not connected to another plan\nPlease ask your friend to add you to their plan\nor\nCreate your own plan`;
    alert(displayMsg);
  }

  function redirectToPlannerPage() {
    window.location.href = '/free-trip-planner';
  }
  //}

  

  document.body.addEventListener('dragstart', e => {
    handleDragStart(e);
  });

  document.body.addEventListener('dragover', e => {
    handleDragOver(e);
  });

  document.body.addEventListener('dragover', e => {
    expandContentWrap(e);
  });

  document.body.addEventListener('drop', e => {
    handleDrop(e);
  });

  

  function handleDragStart(e) {
    if (!e.target.closest('[data-ak="attraction-location"]')) return;
    const $dragEl = e.target.closest('[data-ak="attraction-location"]'); 
    const attractionName = $dragEl.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
    const fromTimeslot = $dragEl.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
    const data = JSON.stringify({ attractionName, fromTimeslot });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragOver(e) {
    if (!e.target.closest('[data-ak="allow-drop"]')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function expandContentWrap(e) {
    if (!e.target.closest('[data-ak-timeslot-title]')) return;
    const $title = e.target.closest('[data-ak-timeslot-title]');
    const $contentWrap = $title.closest('[data-ak-timeslots]').querySelector('[data-ak-timeslot-content]');
    if ($contentWrap.style.height !== '0px') return;
    $title.click(); 
  }

  function handleDrop(e) {
    if (!e.target.closest('[data-ak="allow-drop"]')) return;
    const $dropZone = e.target.closest('[data-ak="allow-drop"]'); 
    e.preventDefault();
    // Get the id of the target and add the moved element to the target's DOM
    const data = e.dataTransfer.getData('text/plain');
    const { attractionName, fromTimeslot } = JSON.parse(data);

    const { $currentSlide, slideIndex } = getCurrentSlideInfo();
    const $activeTimeslot = $currentSlide.querySelector('[data-ak-timeslots].active'); 
    const $morningTimeslot = $currentSlide.querySelector('[data-ak-timeslot="morning"]'); 
    const $timeslot = $activeTimeslot ? $activeTimeslot : $morningTimeslot;
    const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]'); 

    /*if (attractionExists($timeslotWrap, attractionName)) {
      alert('Sorry, Already Added!');
      return; 
    }*/

    const matchingAttraction = [...document.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)')].filter(attraction => {
      const text = attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
      return attractionName.includes(text);
    })[0];

    if (matchingAttraction) {
      $dropZone.appendChild(matchingAttraction);
    }
    else {
      console.log('No matching attraction to move!');
    }

    // if (Clerk.user) {
    //   setUnsavedChangesFlag(); 
    // }
    // else {
      const currentTimeslot = $dropZone.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
      const savedAttractions = localStorage['ak-attractions-saved'] ? JSON.parse(localStorage['ak-attractions-saved']) : {};
      const savedtimeslotAttractions = savedAttractions[`slide${slideIndex}`][fromTimeslot];
      
      if (savedtimeslotAttractions) {
        const savedAttr = savedtimeslotAttractions.filter(attr => data.includes(attr.displayName.toLowerCase().trim()))[0];
        if (savedAttr) {
          const draggedAttr = savedAttractions[`slide${slideIndex}`][fromTimeslot].splice(savedtimeslotAttractions.indexOf(savedAttr), 1)[0];
          savedAttractions[`slide${slideIndex}`][currentTimeslot] = savedAttractions[`slide${slideIndex}`][currentTimeslot] || [];
          savedAttractions[`slide${slideIndex}`][currentTimeslot].push(draggedAttr);
          localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
          localStorage['ak-update-attractions'] = true; 
        }
      }
      setUnsavedChangesFlag(); 
    // }
  }

  async function handleSeverTiesToReferrer() {
    const $currentPlanWrap = document.querySelector('.ak-current-plan-wrap');
    $currentPlanWrap.classList.remove('hide');

    const $createOwnPlanBtn = document.querySelector('[data-ak="create-own-plan"]');
    $createOwnPlanBtn.addEventListener('click', async e => {
      const btnTxt = $createOwnPlanBtn.textContent;
      $createOwnPlanBtn.textContent = 'Processing...';
      await severTiesToReferrer();
      $createOwnPlanBtn.textContent = btnTxt;
    });
    $createOwnPlanBtn.classList.remove('hide'); 

    async function severTiesToReferrer() {
      const currentPlanName = localStorage['ak-user-name'];
      const msg = `Sever ties to ${currentPlanName}'s plan\nProceed?`; 
      if (!confirm(msg)) return;

      await removeReferrerMailReference();
      await removeSecondaryEmailFromReferrer();

      for (let key of Object.keys(localStorage)) {
        if (!key.startsWith('ak-')) continue;
        if (key.includes('ak-userMail')) continue; 
        localStorage.removeItem(key);
      }

      // localStorage.removeItem('ak-referrer-mail');
      // localStorage.removeItem('ak-travel-days');
      // localStorage.removeItem('ak-user-name');

      localStorage['ak-user-name'] = Clerk?.user?.externalAccounts?.[0]?.firstName || '';

      redirectToPlannerPage();
    }

    async function removeReferrerMailReference() {
      const userMail = localStorage['ak-userMail'];
      const userRef = doc(db, 'locationsData', `user-${userMail}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userMailSaveObj = {
        ModifiedAt: serverTimestamp(),
        referrerMail: deleteField(),
      };
      await updateDoc(userRef, userMailSaveObj);
    }

    async function removeSecondaryEmailFromReferrer() {
      const referrerMail = localStorage['ak-referrer-mail'];
      const userRef = doc(db, 'locationsData', `user-${referrerMail}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const data = userSnap.data();
      const { secondaryMail } = data;

      secondaryMail.splice(secondaryMail.indexOf(referrerMail), 1); 

      const userMailSaveObj = {
        ModifiedAt: serverTimestamp(),
        secondaryMail,
      };
      await updateDoc(userRef, userMailSaveObj);
    }
  }

  /*
    function handleSelectPlanToView() {
      const $selectPlanList = document.querySelector('[data-ak="select-plan-list"]');
      const $currentPlanData = document.querySelector('[data-ak="current-plan-data"]');
      $currentPlanData.textContent = referrerMail;

      $selectPlanList.addEventListener('click', e => {
        if (!e.target.closest('.w-dropdown-link')) return;
        const text = e.target.textContent;
        $currentPlanData.textContent = text;
      });
      
      processSelectPlanList(data, userMail, $selectPlanList);
      processSelectPlanList(referrerData, referrerMail, $selectPlanList);

      function processSelectPlanList(data, mail, $selectPlanList) {
        let { tripName } = data;
        const theMail = `${mail}${mail === userMail ? ' (me)' : ''}`;
        const linkName = tripName ? `${tripName.split(/\s+/)[0]} - ${theMail}` : theMail;
        setupSelectPlanList($selectPlanList, linkName);
      }

      function setupSelectPlanList($selectPlanList, linkName) {
        const $navLink = $selectPlanList.querySelector('.w-dropdown-link');
        const $navLinkClone = $navLink.cloneNode(true); 
        $navLinkClone.textContent = linkName;
        $navLinkClone.classList.remove('hide');
        $selectPlanList.append($navLinkClone);
      }
    }
  */

// });




function setUnsavedChangesFlag() {
  $unsavedChanges.classList.remove('hide');
  // localStorage['ak-attractions-saved'] = "{}"; // set ak-attractions-saved as an unsaved changes flag
  localStorage['ak-unsaved-changes'] = true;
}

function removeUnsavedChangesFlag() {
  $unsavedChanges.classList.add('hide');
  // localStorage.removeItem('ak-attractions-saved'); // remove unsaved changes flag
  localStorage.removeItem('ak-unsaved-changes'); 
}







const $secondaryMailWrap = document.querySelector('[data-ak="secondary-email-wrap"]');
const $addMailInp = $secondaryMailWrap.querySelector('.ak-add-mail-input-wrap');
const $addMailBtn = $secondaryMailWrap.querySelector('.ak-mail-btn.ak-add-mail');
const $saveMailBtn = $secondaryMailWrap.querySelector('.ak-mail-btn.ak-save-mail');
const $btnsWrap = $secondaryMailWrap.querySelector('.ak-add-mail-btns');
const saveMailBtnText = $saveMailBtn.textContent;

$secondaryMailWrap.addEventListener('click', e => {
  if (!e.target.closest('.ak-remove-inp')) return;
  const $removeBtn = e.target.closest('.ak-remove-inp');
  $removeBtn.closest('.ak-add-mail-input-wrap').remove();
});

$addMailBtn.addEventListener('click', e => {
  const $input = $addMailInp.cloneNode(true);
  $input.querySelector('.ak-add-mail-input').removeAttribute('id');
  $input.querySelector('.ak-add-mail-input').value = '';
  $input.querySelector('.ak-remove-inp').classList.remove('hidden');
  $secondaryMailWrap.insertBefore($input, $btnsWrap);
});

$saveMailBtn.addEventListener('click', async e => {
  const emailInputsNodeList = $secondaryMailWrap.querySelectorAll('.ak-add-mail-input');
  for (const input of emailInputsNodeList) {
    const mail = input.value.trim();
    if (!mail || !isValidEmail(mail)) {
      highlight(input);
      return;
    }
  }

  $saveMailBtn.textContent = 'Saving...';
  const mailArr = [...emailInputsNodeList].reduce((arr, inp) => {
    const mail = inp.value.trim();
    if (mail) arr.push(mail);
    return arr;
  }, []);

  const saved = await saveMailsDB(mailArr);
  /*if (!saved) return;

  submitInvitedFriendMail(mailArr);

  $saveMailBtn.textContent = saveMailBtnText;
  emailInputsNodeList.forEach(inp => inp.value = '');
  */
  
  $saveMailBtn.textContent = saveMailBtnText;
  $secondaryMailWrap.querySelectorAll('.ak-add-mail-input').forEach(inp => inp.value = '');
});

function isValidEmail(mail) {
  return /.@./.test(mail);
}

function highlight(inp) {
  inp.classList.add('active');
  inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(()=>inp.classList.remove('active'),2000);
}

async function saveMailsDB(mailArr) {  
  const userMail = localStorage['ak-userMail'];
  // Create new added-in users 
  for (const mail of mailArr) {
    const mailRef = doc(db, 'locationsData', `user-${mail}`);
    const mailSnap = await getDoc(mailRef);
    if (mailSnap.exists()) {
      const displayMsg = `Sorry!\nThe user: ${mail}\nAlready has a plan :)`;
      alert(displayMsg);
      return;
    }
    else {
      const saveObj = { 
        CreatedAt: serverTimestamp(),
        referrerMail: userMail,
      };
      await setDoc(mailRef, saveObj);
    }
  }

  // Add a secondary mail to the user-mail 
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);

  const saveObj = { secondaryMail: arrayUnion(...mailArr) };

  if (userSnap.exists()) {
    saveObj.ModifiedAt = serverTimestamp();
    await updateDoc(userRef, saveObj);
  }
  else {
    saveObj.CreatedAt = serverTimestamp();
    await setDoc(userRef, saveObj);
  }

  return true;
}

function submitInvitedFriendMail(mailArr) {
  const $invitedFriendForm = document.querySelector('.invited-friend-mail-form');
  const $invitedFriendMail = $invitedFriendForm.querySelector('#invited-friend-mail');
  const $invitedFriendSubmit = $invitedFriendForm.querySelector('#invited-friend-mail-submit');

  $invitedFriendMail.value = mailArr[0];

  console.log('mailArr[0]::', mailArr[0])
  console.log('$invitedFriendMail.value::', $invitedFriendMail.value)

  $invitedFriendSubmit.click();
}


async function retrieveReferrerData(mail) {
  const referrerData = await retrieveDBData(mail); 
  if (!referrerData) return;
  // const { secondaryMail, tripName, travelDates, savedAttractions, hotel, arrivalAirport, departureAirport } = referrerData;
  // return { secondaryMail, tripName, travelDates, savedAttractions };
  return referrerData;
}

async function retrieveDBData(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
      // docSnap.data() will be undefined in this case
      console.log('No user with such email!', userMail);
      // return; 
  } 

  return docSnap.data(); 
}
 
function setupUserInfo(savedAttractions=undefined, 
                      tripName=undefined, 
                      travelDates=undefined, 
                      hotel=undefined, 
                      arrivalAirport=undefined, 
                      departureAirport=undefined) {
  processTripInfoHeader(tripName, travelDates);
  setupHotelNAirports(hotel, arrivalAirport, departureAirport);
  processSavedAttractions(savedAttractions);
}

function processTripInfoHeader(tripName, travelDates) {
  setupTripNameNTravelDates(tripName, travelDates); 
  showTripInfoHeader(); 
}

function processSavedAttractions(savedAttractions) {
  if (savedAttractions) {
    const savedAttractionsParsed = JSON.parse(savedAttractions);
    restoreSavedAttractions(savedAttractionsParsed);
  }
  else {
    console.log('No saved attractions!');
  }
}

function setupTripNameNTravelDates(tripName, travelDates) {
  if (tripName) {
    tripName = tripName.split(/\s+/)[0];
    setupTripName(tripName);
    localStorage['ak-user-name'] = tripName;
  }

  if (travelDates) {
    const { flatpickrDate } = JSON.parse(travelDates);
    setupTravelDates(flatpickrDate); 

    localStorage['ak-travel-days'] = travelDates;
  }
}

function setupTripName(tripName) {
  const $tripTitleInfo = document.querySelector('.ak-trip-info');
  const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
  $tripTitle.querySelector('[data-ak="trip-user-name"]').textContent = `${tripName}'s`;
}

function showTripInfoHeader() {
  const $tripTitleInfo = document.querySelector('.ak-trip-info');
  $tripTitleInfo.classList.remove('hidden');
}

function setupTravelDates(flatpickrDate) {
  let [ startDate, endDate ] = flatpickrDate.split(/\s+to\s+/);

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  processTitleDates(); 
  setupSliderDates(); 
  reInitWebflow();

  function setupSliderDates() {
    const $firstSlide = $attractionsSlider.querySelector('.w-slide');
    const numberOfDays = daysBetween(startDate, endDate);

    const theStartDate = new Date(startDate);
    updateDayNDate($firstSlide, getDateDetails(theStartDate)); 

    // Remove 2nd slide before populating the slider with new slides
    $attractionsSliderMask.querySelectorAll('.w-slide')[1]?.remove();

    for (let i = 0; i < numberOfDays; i++) {
      const newDate = new Date(theStartDate.setDate(theStartDate.getDate() + 1)); 
      const dateDetails = getDateDetails(newDate); 

      const $slideClone = $firstSlide.cloneNode(true); 

      updateDayNDate($slideClone, dateDetails); 

      $attractionsSliderMask.append($slideClone);
    } 
  }

  function updateDayNDate($slide, { day, month, date, year }) {
    const $day = $slide.querySelector('[data-ak="timeslots-day"]');
    const $date = $slide.querySelector('[data-ak="timeslots-date"]');

    $day.textContent = day; 
    $date.textContent = `${month} ${date}, ${year}`;
  }

  function getDateDetails(theDate) {
    const day = daysArr[theDate.getDay()];
    const month = monthArr[theDate.getMonth()];
    const date = theDate.getDate();
    const year = theDate.getFullYear(); 

    return { day, month, date, year };
  }
  
  function daysBetween(startDate, endDate) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    return (endDateTime - startDateTime) / millisecondsPerDay;
  }

  function processTitleDates() {
    setTitleTravelDates(startDate, endDate);

    function setTitleTravelDates(startDate, endDate) { 
      const titleDates = getTitleTravelDates(startDate, endDate); 
      const $titleTravelDatesEl = document.querySelector('[data-ak="title-travel-dates"]');
      $titleTravelDatesEl.textContent = titleDates;
    }

    function getTitleTravelDates(startDate, endDate) {
      let titleStartDate = new Date(startDate);
      let titleEndDate = new Date(endDate);
      titleStartDate = `${monthArr[titleStartDate.getMonth()]} ${titleStartDate.getDate()}`;
      titleEndDate = `${monthArr[titleEndDate.getMonth()]} ${titleEndDate.getDate()}`;

      const sameDay = titleStartDate === titleEndDate;
      const titleDates = sameDay ? titleStartDate : `${titleStartDate} - ${titleEndDate}`;
      return titleDates;
    }
  }

  function reInitWebflow() {
    Webflow.destroy();
    Webflow.ready();
    Webflow.require('ix2').init(); 
    Webflow.require('slider').redraw();
  }
} 

function setupHotelNAirports(hotel, arrivalAirport, departureAirport) {
  if (hotel && hotel !== 'undefined') {
    processLocation(hotel, '[data-ak="hotel-search-result"]');
  }

  if (arrivalAirport && arrivalAirport !== 'undefined') {
    processLocation(arrivalAirport, '[data-ak="airport-search-result"][data-ak-airport="arrival"]'); 
  }

  if (departureAirport && departureAirport !== 'undefined') {
    processLocation(departureAirport, '[data-ak="airport-search-result"][data-ak-airport="departure"]'); 
  }

  function processLocation(location, $resultWrapName) {
    const locationDetails = JSON.parse(location);
    const $resultWrap = document.querySelector($resultWrapName);
    $resultWrap.saveObj = location;
    setupLocation(location, locationDetails, $resultWrap); 
  }

  function setupLocation(location, locationDetails, $resultWrap) {
    let { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
      type,
    } = locationDetails;

    if (!type) {
      type = locationDetails.types;
    }

    let marker;

    if (location === hotel) {
      marker = createMarker(displayName, {lat, lng}, editorialSummary, type, hotelMarkerPinUrl); 
      markerObj['hotel'] = marker;
    }
    else {
      const markerPinUrl = getCorrectTransportationPinUrl(type);
      marker = createMarker(displayName, {lat, lng}, editorialSummary, type, markerPinUrl); 
      if (location === arrivalAirport) {
        markerObj['airport-arrival'] = marker;
      }
      else {
        markerObj['airport-departure'] = marker;
      }
    }

    addLocationToResultWrap(displayName, marker, $resultWrap); 

    // console.log('markerObj::', markerObj)
  }
}


/*
let map, infoWindow;
const locationNYC = { lat: 40.7580, lng: -73.9855 };
const markerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/677cc99549bcbb38edad633e_pin24.png';
const directionsUrlBase = 'https://www.google.com/maps/search/';
const mapFetchFields = ['displayName', 'location', 'editorialSummary', 'formattedAddress', 'photos', 'rating', 'reviews'];
// const $timeslots = document.querySelectorAll('[data-ak-timeslots]');
const $titleInfoSkeletonWrap = document.querySelector('.ak-skeleton-wrap');
const $tripTitleInfo = document.querySelector('.ak-trip-info');
const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');
const $saveItineraryBtn = document.querySelector('[data-ak="save-itinerary"]');
const markerArr = [];
const attractionslimit = 7;
*/

/*document.addEventListener('DOMContentLoaded', () => {
  saveAttractionsDB();
});*/

/*const $clerkLoginBtn = document.querySelector('[data-ak="clerk-login"]');
$clerkLoginBtn.addEventListener('click', e => {
  e.preventDefault();
  saveAttractionsDB();
  console.log('Saved to DB')
  window.location.href = '/log-in';
});*/
// console.log('we here!')
$saveItineraryBtn.addEventListener('click', async e => {
    e.preventDefault();
    console.log('Save btn clicked!!')
    await saveAttractionsDB();
    console.log('============================');
    console.log('Saved to DB')
    // localStorage.removeItem('ak-attractions-saved');
    // $unsavedChanges.classList.add('hide');
    removeUnsavedChangesFlag(); 
});

async function saveAttractionsDB() {  
    if (!localStorage['ak-userMail']) return;
    // const savedAttractions = localStorage['ak-attractions-saved'];
    const userMail = localStorage['ak-referrer-mail'] ? localStorage['ak-referrer-mail'] : localStorage['ak-userMail'];

    const userRef = doc(db, 'locationsData', `user-${userMail}`);
    const userSnap = await getDoc(userRef);

    let tripName = '', travelDates='', hotel='', arrivalAirport='', departureAirport='', savedAttractions='{}';
    if (localStorage['ak-hotel']) hotel = localStorage['ak-hotel']; 
    if (localStorage['ak-arrival-airport']) arrivalAirport = localStorage['ak-arrival-airport'];
    if (localStorage['ak-departure-airport']) departureAirport = localStorage['ak-departure-airport'];   
    if (localStorage['ak-user-name']) tripName = localStorage['ak-user-name']; 
    if (localStorage['ak-travel-days']) travelDates = localStorage['ak-travel-days'];

    // if (!tripName || !travelDates) return;
    savedAttractions = getCurrentUserAttractions();

    const saveObj = { hotel, arrivalAirport, departureAirport, tripName, travelDates, savedAttractions };

    if (userSnap.exists()) {
      // console.log('userSnap exists', userSnap.exists())
      saveObj.ModifiedAt = serverTimestamp();
      await updateDoc(userRef, saveObj);
    }
    else {
      // console.log('userSnap does not exist')
      saveObj.CreatedAt = serverTimestamp();
      await setDoc(userRef, saveObj);
    }

    // remove all -update flags on save to db
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('ak-update')) continue;
      console.log('key::', key)
      localStorage.removeItem(key);
    }
}

function getCurrentUserAttractions() {
  let savedAttractions = {};

  const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
  $attractionsSlider.querySelectorAll('.w-slide').forEach((slide, n) => {
    savedAttractions[`slide${n+1}`] = {}; 
    const slideObj = savedAttractions[`slide${n+1}`];
      
    slide.querySelectorAll('[data-ak-timeslots] [data-ak-timeslot-content]').forEach(timeslotContent => {
      const timeslot = timeslotContent.querySelector('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap');
      
      slideObj[timeslot] = [];
        
      timeslotContent.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)').forEach(attraction => {
        const name = attraction.querySelector('[data-ak="location-title"]').textContent.trim();
        const { saveObj: { location, displayName, editorialSummary } } = attraction;          
        slideObj[timeslot].push({ location, displayName, editorialSummary}); 
      });
    });
  });

  savedAttractions = JSON.stringify(savedAttractions);

  return savedAttractions;
}

async function createUserInFirebase(userMail) {
  if (!userMail) return;
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;
  await setDoc(userRef, { CreatedAt: serverTimestamp() }); 
}

// $titleInfoSkeletonWrap.classList.remove('hidden');

function addAttractionToList(name, $listName, marker=null, saveObj={}) {
  name = format(name); 
  const $location = $listName.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  $location.marker = marker;
  $location.saveObj = saveObj;
  $listName.append($location);
}

function createMarker(title, position, editorialSummary=title, type=[], markerPinSrc=cameraPinUrl) {
  const markerPinImg = document.createElement('img');

  // console.log('type::', type) 
  const restaurant = type.includes('restaurant') || type.includes('food');
  markerPinImg.src = restaurant && markerPinSrc !== hotelMarkerPinUrl ? foodForkPinUrl : markerPinSrc;
  markerPinImg.className = 'ak-marker-pin';
  const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title,
      content: markerPinImg,
      gmpClickable: true,
  });
  
  const content = 
  `<div class="marker-popup-title">${title}</div>
  <div class="marker-popup-desc">${editorialSummary || title}</div>`;

  marker.addListener('gmp-click', ({ domEvent, latLng }) => {    
    infoWindow.close();
    infoWindow.setContent(content); // (marker.title);
    infoWindow.open(marker.map, marker);
  });

  return marker;
} 



/*if (localStorage['ak-user-name'] && !localStorage['ak-referred']) {
  let name = localStorage['ak-user-name'];
  name = name.split(/\s+/)[0];
  const occasion = localStorage['ak-occasion'] ? format(localStorage['ak-occasion']) : '';
  $tripTitle.textContent = `${name}'s ${occasion ? occasion : ''}${occasion.toLowerCase().slice(-4).includes('trip') ? '' : ' Trip'}`;

  showTripTitleInfo();
}
else if (!localStorage['ak-user-name'] && localStorage['ak-occasion']) {
  const occasion = format(localStorage['ak-occasion']); 
  $tripTitle.textContent = `${occasion}${occasion.toLowerCase().slice(-4).includes('trip') ? '' : ' Trip'}`;

  showTripTitleInfo(); 
}
// $tripTitle.classList.remove('hidden');
else {
  showTripTitleInfo(); 
}

function showTripTitleInfo() {
  // $titleInfoSkeletonWrap.classList.add('hidden'); 
  $tripTitleInfo.classList.remove('hidden');
}*/

function format(str) {
  if (!str) return; 
  return str = str.trim().split(/\s+/).map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

!async function setupHotelAutocomplete() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: {country: ['us']},
      includedRegionCodes: ['us'],
      locationBias: {
        radius: 5000.0,
        center: mapCenter,
      },
      includedPrimaryTypes: ['lodging', 'hotel'], 
  });

  const $autocompleteWrap = document.querySelector('[data-ak="hotel-autocomplete"]');
  $autocompleteWrap?.appendChild(placeAutocomplete);

  const placeholderText = 'Search for hotel...'; 
  // if (placeAutocomplete.Eg) {
  //   placeAutocomplete.Eg.setAttribute('placeholder', placeholderText);
  // }

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-select', async (res) => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });

    if (place.viewport) {
      map.panTo(place.viewport);
    }
    else {
      map.panTo(place.location);
    }

    const placeObj = place.toJSON(); 

    resetUserInputField();
    function resetUserInputField() {
      const $userInputWrap = res.target?.Zg;
      if (!$userInputWrap) return;
      const $userInput = $userInputWrap.querySelector('input');    
      if ($userInput) $userInput.value = '';
      // $userInput.setAttribute('placeholder', placeholderText);
    }
    
    const { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
      types: type,
    } = placeObj; 

    const marker = createMarker(displayName, {lat, lng}, editorialSummary, type, hotelMarkerPinUrl); 
    // markerArr.push(marker); 
    if (markerObj['hotel']) markerObj['hotel'].setMap(null);
    markerObj['hotel'] = marker;
    
    // console.log('markerObj::', markerObj)

    const $hotelResultWrap = document.querySelector('[data-ak="hotel-search-result"]');
    addLocationToResultWrap(displayName, marker, $hotelResultWrap); 

    setUnsavedChangesFlag(); 

    localStorage['ak-hotel'] = JSON.stringify(placeObj);
    localStorage['ak-update-hotel'] = true;
  });
}(); 

!async function setupAirportAutocomplete() {
  await google.maps.importLibrary('places');

  document.querySelectorAll('[data-ak="airport-autocomplete"]').forEach(autocomplete => {
    // Create the input HTML element, and append it.
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: {country: ['us']},
        includedRegionCodes: ['us'],
        locationBias: {
          radius: 5000.0,
          center: mapCenter,
        },
        includedPrimaryTypes: ['airport', 'ferry_terminal', 'international_airport', 'bus_station', 'train_station'], 
    });

    autocomplete.appendChild(placeAutocomplete);

    const placeholderText = 'Search for airport...'; 
    // if (placeAutocomplete.Eg) {
    //   placeAutocomplete.Eg.setAttribute('placeholder', placeholderText);
    // }
    
    // Add the gmp-placeselect listener, and display the results.
    placeAutocomplete.addEventListener('gmp-select', async (res) => {
      const { placePrediction } = res;
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary', 'types'] });

      if (place.viewport) {
        map.panTo(place.viewport);
      }
      else {
        map.panTo(place.location);
      }

      const placeObj = place.toJSON(); 

      resetUserInputField();
      function resetUserInputField() {
        const $userInputWrap = res.target?.Zg;
        if (!$userInputWrap) return;
        const $userInput = $userInputWrap.querySelector('input');    
        if ($userInput) $userInput.value = '';
        // $userInput.setAttribute('placeholder', placeholderText);
      }
      
      const { 
        displayName, 
        location: { lat, lng },
        editorialSummary,
        types: type,
      } = placeObj; 

      console.log('type::', type)

      const markerPinUrl = getCorrectTransportationPinUrl(type);

      const marker = createMarker(displayName, {lat, lng}, editorialSummary, type, markerPinUrl); 
      // markerArr.push(marker);

      const airportType = autocomplete.getAttribute('data-ak-airport');
      if (airportType.includes('arrival')) {
        localStorage['ak-arrival-airport'] = JSON.stringify(placeObj);
        localStorage['ak-update-arrival-airport'] = true; 
        if (markerObj['airport-arrival']) markerObj['airport-arrival'].setMap(null);
        markerObj['airport-arrival'] = marker;
      }
      else {
        localStorage['ak-departure-airport'] = JSON.stringify(placeObj);
        localStorage['ak-update-departure-airport'] = true;  
        if (markerObj['airport-departure']) markerObj['airport-departure'].setMap(null);
        markerObj['airport-departure'] = marker;
      }

      // console.log('markerObj::', markerObj)

      const $resultWrap = autocomplete.closest('.form_row').querySelector('[data-ak="airport-search-result"]');
      addLocationToResultWrap(displayName, marker, $resultWrap);
      
      setUnsavedChangesFlag(); 
    });
  });
}(); 

function getCorrectTransportationPinUrl(type) {
  let markerPinUrl = airportMarkerPinUrl;

  console.log('type', type)

  if (!type) return;

  if (type.includes('bus_station')) {
    markerPinUrl = busPinUrl;
  }
  else if (type.includes('train_station')) {
    markerPinUrl = trainPinUrl;
  }

  /*const formatttedDisplayName = displayName.toLowerCase().trim();
  if (formatttedDisplayName.includes('port authority bus terminal')) {
    markerPinUrl = busPinUrl;
  }
  else if (formatttedDisplayName.includes('penn station')) {
    markerPinUrl = trainPinUrl
  }*/

  return markerPinUrl;
}

function addLocationToResultWrap(name, marker, $resultWrap) {
  const $location = document.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  $location.marker = marker;
  // $location.saveObj = saveObj;
  $resultWrap.innerHTML = '';
  $resultWrap.append($location);
}

!async function setupAutocompleteInp() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: ['us'] },
      includedRegionCodes: ['us'],
      locationBias: {
        radius: 5000.0,
        center: mapCenter,
      }, 
  }); 

  const $autocompleteWrap = document.querySelector('.ak-autocomplete');
  $autocompleteWrap.appendChild(placeAutocomplete);

  const searchAttractionsPlaceholderTxt = 'Add an activity...';

  // if (placeAutocomplete.target?.Zg) {
  //   const $userInputWrap = res.target?.Zg;
  //   const $userInput = $userInputWrap.querySelector('input');    
  //   $userInput.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
  // }

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-select', async (res) => {
      if (!Clerk.user) {
        if (addedAttractions >= attractionslimit) {
          alert('Max Limit Reached. Login To Add More');
          resetUserInputField();
          return;
        }

        addedAttractions += 1;
        localStorage['ak-addedAttractions-count'] = addedAttractions; 

        localStorage['ak-update-merge-local'] = true;
      }

      resetUserInputField();
      function resetUserInputField() {
        const $userInput = res.target?.Dg;
        if (!$userInput) return;
        $userInput.value = '';
        $userInput.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
      }

      const { placePrediction } = res;
      const place = placePrediction.toPlace();

      // console.log('res::', res)
      // console.log('place::', place)

      await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary', 'types'] });

      if (place.viewport) {
        // map.fitBounds(place.viewport);
        map.panTo(place.viewport);
      }
      else {
        // map.setCenter(place.location);
        // map.setZoom(17);
        map.panTo(place.location);
      }

      const placeObj = place.toJSON(); 

      // console.log('placeObj', placeObj)
      
      const { 
        displayName, 
        location: { lat, lng },
        editorialSummary,
        types: type,
      } = placeObj; 

      const { $currentSlide, slideIndex } = getCurrentSlideInfo();

      const marker = createMarker(displayName, {lat, lng}, editorialSummary, type); 
      markerObj[`slide${slideIndex}`] = markerObj[`slide${slideIndex}`] || [];
      markerObj[`slide${slideIndex}`].push(marker);

      // console.log('markerObj::', markerObj)

      const saveObj = {
        // marker,
        location: { lat, lng }, 
        displayName,
        editorialSummary,
        type,
      };

      const addNSaveObj = { slideIndex, displayName, marker, saveObj };
      processAttractionSave($currentSlide, addNSaveObj);

      // showHideUnsavedChangesMsg();
      setUnsavedChangesFlag(); 
  });

  function processAttractionSave($currentSlide, addNSaveObj) {
    const $activeTimeslot = $currentSlide.querySelector('[data-ak-timeslots].active'); 
    const $morningTimeslot = $currentSlide.querySelector('[data-ak-timeslot="morning"]'); 
    let $timeslot = $activeTimeslot ? $activeTimeslot : $morningTimeslot;
    expandContentWrap($timeslot);
    addNSaveAttraction($timeslot, addNSaveObj);
  }

  function expandContentWrap($timeslot) {
    if ($timeslot.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
      $timeslot.querySelector('[data-ak-timeslot-title]').click(); 
    }
  }

  function addNSaveAttraction($timeslot, addNSaveObj) {
    const { slideIndex, displayName, marker, saveObj } = addNSaveObj;
    const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]'); 
    const timeslotName = $timeslot.getAttribute('data-ak-timeslot'); // .querySelector('[data-ak-timeslot-title]').textContent.trim().toLowerCase(); 
    if (attractionExists($timeslotWrap, displayName)) {
      alert('Sorry, Already Added!');
      removeUnsavedChangesFlag(); 
      return;
    }
    addAttractionToList(displayName, $timeslotWrap, marker, saveObj);
    saveAttractionLocal(timeslotName, slideIndex, saveObj); 
    // saveAttractionsDB();
  }
}();   

function attractionExists(wrap, name) {
  const match = [...wrap.querySelectorAll('[data-ak="attraction-location"]:not(.hidden) [data-ak="location-title"]')].filter(attraction => {
    const attractionName = attraction.textContent.toLowerCase().trim();
    return attractionName === name.toLowerCase().trim();
  });
  // console.log('match:::', match)
  // console.log(':::', match[0])
  return match.length; 
}

function saveAttractionLocal() { // (currentTimeslotName, slideIndex, saveObj) {
  // const savedAttractions = localStorage['ak-attractions-saved'] ? JSON.parse(localStorage['ak-attractions-saved']) : {};
  // savedAttractions[`slide${slideIndex}`] = savedAttractions[`slide${slideIndex}`] || {};
  // savedAttractions[`slide${slideIndex}`][currentTimeslotName] = savedAttractions[`slide${slideIndex}`][currentTimeslotName] || [];
  // savedAttractions[`slide${slideIndex}`][currentTimeslotName].push(saveObj);
  
  const savedAttractions = getCurrentUserAttractions();
  localStorage['ak-attractions-saved'] = savedAttractions;
  localStorage['ak-update-attractions'] = true; 
}

$attractionsSlider.addEventListener('click', e => {
  if (!e.target.closest('[data-ak-timeslot-title]')) return;
  const $title = e.target.closest('[data-ak-timeslot-title]');
  const $currentSlide = $title.closest('.w-slide');
  $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
  const $timeslot = $title.closest('[data-ak-timeslots]');
  $timeslot.classList.add('active');
});

// document.body.addEventListener('click', e => {
$attractionsSlider.addEventListener('click', e => {
    handleSliderRemoveLocation(e);
});

document.querySelector('[data-ak="travel-details"]').addEventListener('click', e => {
  handleTravelResultsRemoveLocation(e);
});

function handleTravelResultsRemoveLocation(e) {
  if (!e.target.closest('[data-ak="remove-location"]')) return;
  const $removeBtn = e.target.closest('[data-ak="remove-location"]');
  const $attraction = $removeBtn.closest('[data-ak="attraction-location"]');
  const $resultWrap = $removeBtn.closest('[data-ak-search-result]');

  if ($attraction.marker) {
    $attraction.marker.setMap(null); 
    // markerArr.splice(markerArr.indexOf($attraction.marker), 1);   
  }

  const dataAk = $resultWrap.getAttribute('data-ak');
  const airportType = $resultWrap.getAttribute('data-ak-airport');
  if (airportType) {
    if (airportType.includes('arrival')) {
      localStorage.removeItem('ak-arrival-airport');
      delete markerObj['airport-arrival'];
    }
    else {
      localStorage.removeItem('ak-departure-airport');
      delete markerObj['airport-departure'];
    }
  }
  else if (dataAk.includes('hotel')) {
    localStorage.removeItem('ak-hotel');
    delete markerObj['hotel'];
  }

  // console.log('markerObj::', markerObj)

  $attraction.remove();

  setUnsavedChangesFlag();
}

function handleSliderRemoveLocation(e) {
  if (!e.target.closest('[data-ak="remove-location"]')) return;
  // console.log('e.target::::::', e.target)

  const $removeBtn = e.target.closest('[data-ak="remove-location"]');
  const $attraction = $removeBtn.closest('[data-ak="attraction-location"]');

  // console.log('$removeBtn', $removeBtn)
  // console.log('$attraction', $attraction)

  // if (Clerk.user) {
  //   setUnsavedChangesFlag(); 
  // }
  // else {
    const { slideIndex } = getCurrentSlideInfo();
    const savedAttractions = localStorage['ak-attractions-saved'];
    if (savedAttractions && Object.keys(savedAttractions).length) {
      const attrName = $attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
    
      const savedAttractionsParsed = JSON.parse(savedAttractions);
      
      const timeslot = $removeBtn.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
      const timeslotArr = savedAttractionsParsed[`slide${slideIndex}`][timeslot];
      const attrMatch = timeslotArr?.filter(attr => attrName.includes(attr.displayName.toLowerCase().trim()))[0];
      if (attrMatch) timeslotArr.splice(timeslotArr.indexOf(attrMatch),1);
      localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractionsParsed);
      localStorage['ak-update-attractions'] = true;
    }
  // }

  if ($attraction.marker) {
    $attraction.marker.setMap(null); 
    
    markerObj[`slide${slideIndex}`] = markerObj[`slide${slideIndex}`] || [];
    markerObj[`slide${slideIndex}`].splice(markerObj[`slide${slideIndex}`].indexOf($attraction.marker), 1); 

    // console.log('markerObj::', markerObj)
  }

  $attraction.remove();

  setUnsavedChangesFlag(); 

  if (!Clerk.user) {
    addedAttractions -= 1;
    localStorage['ak-addedAttractions-count'] = addedAttractions; 
  }
}

// function showHideUnsavedChangesMsg() {
//   if (localStorage['ak-unsaved-changes']) {
//       $unsavedChanges.classList.remove('hide');
//   }
//   else {
//       $unsavedChanges.classList.add('hide');
//   }
// }



function getCurrentSlideInfo() {
  const $currentSlide = document.querySelector('.w-slide:not([aria-hidden="true"])');
  const slideIndex = [...$attractionsSliderMask.querySelectorAll('.w-slide')].indexOf($currentSlide) + 1;
  return { $currentSlide, slideIndex }; 
}

document.body.addEventListener('click', e => {
  if (e.target.closest('[data-ak="locations-slider-wrap"]')) return;
  const $currentSlide = document.querySelector('.w-slide:not([aria-hidden="true"])');
  if ($currentSlide) $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
});



document.body.addEventListener('click', e => {
  if (!e.target.closest('[data-ak="location-link"]')) return;
  const $locationLink = e.target.closest('[data-ak="location-link"]'); 
  const $location = $locationLink.closest('[data-ak="attraction-location"]');
  const $prevLocation = $location.previousElementSibling;

  if (!$location.marker) {
    console.log('Sorry! No location marker info.');
    return; 
  }

  const lat = $location.marker?.position.lat || null;
  const lng = $location.marker?.position.lng || null; 

  if (!lat) {
    console.log('Sorry! No location marker info.');
    return; 
  }

  const url = `${directionsUrlBase}?api=1&query=${lat}%2C${lng}`;  
  window.open(url); 
});

/*if (!localStorage['ak-referred']) {
  if (localStorage['ak-user-name']) {
    let tripName = localStorage['ak-user-name'];
    if (tripName) tripName = tripName.split(/\s+/)[0];
    setupTripName(tripName); 
  }
  
  if (localStorage['ak-travel-days']) {
    const { flatpickrDate } = JSON.parse(localStorage['ak-travel-days']);
    setupTravelDates(flatpickrDate); 
  }
}*/

  
function restoreSavedAttractions(savedAttractions) {
  const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
  const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');

  for (const [slide, attractions] of Object.entries(savedAttractions)) {
    const slideNum = Number(slide.match(/\d+/)[0]);
    
    const $currentSlide = [...$attractionsSliderMask.querySelectorAll('.w-slide')][slideNum-1];

    if (!$currentSlide) continue;

    const $morningWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="morning"]');
    const $afternoonWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="afternoon"]');
    const $eveningWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="evening"]');

    const { morning, afternoon, evening } = attractions;

    if (morning && morning.length) {
      processSectionAttractions(morning, $morningWrap, slideNum);
    }
    if (afternoon && afternoon.length) {
      processSectionAttractions(afternoon, $afternoonWrap, slideNum);
    }
    if (evening && evening.length) {
      processSectionAttractions(evening, $eveningWrap, slideNum);
    }
  }

  $attractionsSliderMask.querySelector('.w-slide .active')?.classList.remove('active');

  function processSectionAttractions(attractions, $sectionWrap, slideNum) {
    attractions.forEach(attraction => {
      const { displayName, editorialSummary, location, type } = attraction;
      const marker = createMarker(displayName, location, editorialSummary, type);
      const saveObj = { displayName, editorialSummary, location };
      addAttractionToList(displayName, $sectionWrap, marker, saveObj);

      markerObj[`slide${slideNum}`] = markerObj[`slide${slideNum}`] || [];
      markerObj[`slide${slideNum}`].push(marker);
    });

    // console.log('markerObj::', markerObj)

    const $timeslotSec = $sectionWrap.closest('[data-ak-timeslots]');
    if ($timeslotSec.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
      $timeslotSec.querySelector('[data-ak-timeslot-title]').click(); 
    }
  }
}   


// start 'All radio-btn' in checked state
document.querySelector('.ak-map-pins-wrap input[type=radio][value="*"]')?.click(); 

$mapPinsRadios.forEach(radioBtn => {
  radioBtn.addEventListener('click', e => {
    const val = radioBtn.value;
    showHidePins(val);
  });
});

$sliderArrows.forEach(sliderArrow => {
  sliderArrow.addEventListener('click', e => {
    const checkedVal = document.querySelector('[name="View-Map-Pins"]:checked')?.value;
    showHidePins(checkedVal);
  });
});

function showHidePins(val) {
  if (!val) return;
  if (val === '*') {
    showAllPins();
  }
  else { // by-day
    filterByDay();
  }
}

function showAllPins() {
  for (const [key, markerArr] of Object.entries(markerObj)) {
    if (!key.startsWith('slide')) continue;
    markerArr.forEach(marker => marker.setMap(map));
  }
}

function hideAllPins() {
  for (const [key, markerArr] of Object.entries(markerObj)) {
    if (!key.startsWith('slide')) continue;
    markerArr.forEach(marker => marker.setMap(null));
  }
}

function showSlidePins() {
  const { slideIndex } = getCurrentSlideInfo();
  const markers = markerObj[`slide${slideIndex}`];
  if (markers) markers.forEach(marker => marker.setMap(map));
}

function filterByDay() {
  hideAllPins();
  showSlidePins();
}



});

function parseJSON(jsonStr) {
  let jsonObj = null;

  try {
    jsonObj = JSON.parse(jsonStr);
  }
  catch (e) {
      return null;
  }

  return jsonObj;
}

