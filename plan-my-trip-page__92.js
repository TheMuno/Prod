 // Import specific functions from the modular SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js';

$(document).ready(()=>{
// CHECKOUT_SIGNATURE_SECRET Firebase Secret!
const CHECKOUT_SIGNATURE_SECRET_VALUE = "d8cc622026d9207029e4b9d98e7ccd09a60d9b1908e29915419ccecdf7ddde3d"; 

// ==========================================================
// STEP 2: CONFIGURATION & INITIALIZATION
// ==========================================================

const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId: "G-Z7F4NJ4PHW"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Get a reference to the Cloud Functions service, specifying the region here.
const functions = getFunctions(app, 'us-central1'); 

// Get a reference to the specific callable function
const createCheckout = httpsCallable(functions, 'createCheckoutSession');

// Initialize Stripe
const stripe = Stripe("pk_test_51SnIVLBibJetjBcigVtuskiXtIJ5C5YmTJNcAae2ZbxKj86kWlsyHavfDqqbi8po1hn16PonNRBTzA33jc3EH9nf00g2VcbiZR");

// Constants for server-side logic
const PRICE_STANDARD = "price_1SW0DeBPPSonNtdrO5pxx47B"; // "price_1SbKPoBFhUWCg8lbcC2uiSda"; 
const PRICE_RUSH = "price_1Sg4QlBPPSonNtdrMBRy2x0O"; // "price_1SbKQRBFhUWCg8lbn41gmIGf";

// State variables
// let eventDate = new Date();



async function startCheckout(userData) {
  const eventDate = localStorage['ak-event-date-stripe'];
  if (!eventDate) {
      showError("Please select a valid starting date for your trip.");
      return;
  }

  try {
      console.log('Starting secure checkout process...');
      
      // 1. Prepare Data for Date Calculation (YYYY-MM-DD string)
      const vacationDateStr = new Date(eventDate).toISOString().split('T')[0].trim();
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const msPerDay = 1000 * 60 * 60 * 24;
      const msSinceEpochToday = new Date(todayStr).getTime();
      const msSinceEpochUserDate = new Date(vacationDateStr).getTime();

      const diffDays = Math.floor((msSinceEpochUserDate - msSinceEpochToday) / msPerDay);
      
      // 2. Determine Price and Generate Signature (Using HMAC)
      const encoder = new TextEncoder();
      const trimmedSecret = CHECKOUT_SIGNATURE_SECRET_VALUE.trim(); 
      
      // 🎯 Business Logic: 21 days or less is RUSH, more than 21 days is STANDARD
      const calculatedPriceId = diffDays <= 21 ? PRICE_RUSH : PRICE_STANDARD;
      const trimmedPrice = calculatedPriceId.trim();

      // Data string MUST match the server's data string exactly (no secret in this string!)
      // The secret is used as the KEY for HMAC
      const dataToSign = encoder.encode(`${vacationDateStr}.${trimmedPrice}`); 
      const secretKeyBytes = encoder.encode(trimmedSecret);

      // --- HMAC Signature Generation ---
      const key = await crypto.subtle.importKey(
          "raw", // format
          secretKeyBytes,
          { name: "HMAC", hash: "SHA-256" }, // algorithm
          false, // exportable
          ["sign"] // uses
      );

      const hash = await crypto.subtle.sign(
          "HMAC", 
          key, 
          dataToSign
      );

      // Convert the ArrayBuffer hash to a hex string
      const signature = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");

      console.log('Price ID used:', trimmedPrice);
      console.log('Signature generated:', signature);
          
      // 3. Call the Firebase Callable Function
      const result = await createCheckout({
        vacationDate: vacationDateStr,
        requestedPriceId: trimmedPrice, 
        signature: signature,
        ...userData,
      });

      // 4. Handle response and redirect
      const dataResp = result.data;

      if (dataResp.error) {
          console.error("Function Error:", dataResp.error);
          showError("Checkout failed: " + dataResp.error);
          return;
      }

      if (dataResp.url) {
          console.log('Redirecting to Stripe URL:', dataResp.url);
          window.location.href = dataResp.url;
      } else {
          showError("Failed to create Stripe session.");
      }

  } catch (error) {
      console.error('An unhandled error occurred:', error);
      showError("An internal error prevented the checkout process.");
  }
}




// CONFIG
const spreadsheetId = '1Ef5djoE68lL_qn_Qk7PlRB676UdF-zLF43aerF4A5mE';
const apiKey = 'AIzaSyDQpFatuEeQMlVkMK8y4BjhVMH0dexgKeU';
const sheetName = 'Sheet1';
const pageSize = 500;        // rows per page (adjust)
const maxPages = 20;        // safety cap to avoid infinite loop
const cacheKeyPrefix = 'ak-sheet-page'; // sessionStorage key prefix
const cacheDurationMs = 10 * 60 * 1000; // 10 minutes per page
const maxRetries = 3;
const baseDelay = 800;      // base ms for exponential backoff
const debounceDelay = 800;  // debounce for public fetch call

const rushOrderWeeks = 3;
const setMinHrs = 3;
const today = new Date(); 

let $mainForm = $('#wf-form-Plan-My-Trip-Form');
if ($mainForm.length === 0) {
  $mainForm = $('#wf-form-Plan-My-Trip-Form-HereBeBarr');
}

const $travelDate = document.querySelector('[data-ak="user-travel-dates-trip-plan"]');

// Debounced public wrapper
const fetchAllSheetDataDebounced = debounce(fetchAllSheetData, debounceDelay);

!async function setupDatepicker() {
  const rushOrderWeeks = 3;
  const rushOrderDays = rushOrderWeeks * 7;

  // Add loading guard to prevent flicker
  $travelDate.classList.add("fp-loading");

  const unavailableDates = await getUnavailableDates();
  const disabledDates = unavailableDates.map((d) => d.date);

  const fp = flatpickr($travelDate, {
    mode: "range",
    altInput: true,
    enableTime: false,
    altFormat: "D M j",
    dateFormat: "Y-m-d",
    minDate: "today",

    // 🎨 Paint each day as it’s created
    onDayCreate: function (dObj, dStr, fp, dayElem) {
      const date = new Date(dayElem.dateObj);
      const unavailable = unavailableDates.find(
        (d) => d.date.toDateString() === date.toDateString()
      );

      const today = new Date();
      const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

      // 🚀 Rush period (first N weeks)
      if (diffDays >= 0 && diffDays < rushOrderDays) {
        dayElem.classList.add("fp-rush");
        dayElem.dataset.tooltip = "Rush";
      }

      // ⚠️ High Demand after rush period
      if (diffDays >= rushOrderDays && unavailable && unavailable.reason === "High Demand") {
        dayElem.classList.add("fp-unavailable");
        dayElem.dataset.tooltip = "High Demand";
      }
    },

    onOpen(selectedDates, dateStr, instance) {
      $mainForm[0]
        .querySelectorAll(".foxy-date-input")
        .forEach((inp) => inp.remove());
    },

    // ✅ Validate START DATE
    async onClose(selectedDates, dateStr, instance) {
      if (!selectedDates.length) return;

      localStorage['ak-event-date-stripe'] = selectedDates[0];

      const flatpickrDateObj = { selectedDates, dateStr };
      localStorage["ak-flatpickrDateObj"] = JSON.stringify(flatpickrDateObj);

      const startDate = selectedDates[0];
      const startDayData = unavailableDates.find(
        (d) => new Date(d.date).toDateString() === startDate.toDateString()
      );

      const today = new Date();
      const diffDays = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));
      const isRush = diffDays >= 0 && diffDays < rushOrderDays;
      const isHighDemand = diffDays >= rushOrderDays && startDayData?.reason === "High Demand";

      // if (isRush || isHighDemand) {
      if (isHighDemand) {
        let arrivalDate = new Date(selectedDates[0]).toDateString();
        arrivalDate = `${arrivalDate.substring(0,3)},${arrivalDate.substring(3)}`;
        showError(`Sorry our team is at full capacity for your arrival date: ${arrivalDate}. To be notified when capacity is free, send an email to hello@askkhonsu.com with subject "notify" and we will contact you when our team is free.`);
        instance.clear();
        return;
      }

      processDatepickerClose(selectedDates, dateStr);
    },

    // 🔁 Debounced refresh hooks
    async onReady(selectedDates, dateStr, instance) {
      await setupDateIndicators(instance);
      $travelDate.classList.remove("fp-loading");
      instance.calendarContainer.classList.add("fp-ready");
    },
    async onMonthChange(selectedDates, dateStr, instance) {
      await debouncedReapply(instance);
    },
    async onValueUpdate(selectedDates, dateStr, instance) {
      await debouncedReapply(instance);
    },
    async onChange(selectedDates, dateStr, instance) {
      await debouncedReapply(instance);
    },
  });

  const debouncedReapply = debounce(async (instance) => {
    await setupDateIndicators(instance);
  }, 200);

  // 🧩 Color + Tooltip setup
  async function setupDateIndicators(fpInstance, minHrs = setMinHrs) {
    const daysData = await fetchAllSheetDataDebounced();
    const calendar = fpInstance.calendarContainer;
    if (!calendar) return;

    const dayEls = calendar.querySelectorAll(".flatpickr-day");
    const today = new Date();

    dayEls.forEach((dayEl) => {
      const date = new Date(dayEl.dateObj);
      const dateStr = date.toDateString();
      const dayData = daysData.find(
        (d) => new Date(d.date).toDateString() === dateStr
      );
      const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

      dayEl.removeAttribute("data-tooltip");
      dayEl.classList.remove("fp-available", "fp-unavailable", "fp-rush");

      // 🚀 Rush period
      if (diffDays >= 0 && diffDays < rushOrderDays) {
        dayEl.classList.add("fp-rush");
        dayEl.dataset.tooltip = "Rush";
        return;
      }

      if (!dayData) return;

      const available = dayData.available?.toLowerCase() === "true";
      const capacity = parseInt(dayData.capacity || 0);

      console.log('dayData:', dayData);
      console.log('============================');
      console.log('\n');

      console.log('dayData.available?.toLowerCase():', dayData.available?.toLowerCase());
      console.log('available:', available);
      console.log('capacity:', capacity);
      console.log('============================');
      console.log('\n');

      console.log('diffDays >= rushOrderDays:', diffDays >= rushOrderDays);
      console.log('!available', !available);
      console.log('capacity < minHrs', capacity < minHrs);
      console.log('minHrs:', minHrs);
      console.log('(!available || capacity < minHrs):', (!available || capacity < minHrs));
      console.log('(diffDays >= rushOrderDays && (!available || capacity < minHrs)):', (diffDays >= rushOrderDays && (!available || capacity < minHrs)));
      console.log('============================');
      console.log('############################');
      console.log('\n');

      if (diffDays >= rushOrderDays && (!available || capacity < minHrs)) {
        dayEl.classList.add("fp-unavailable");
        dayEl.dataset.tooltip = "High Demand";
        return;
      }

      // dayEl.classList.add("fp-available");
    });

    attachSmartTooltip();
  }

  // 🧠 Tooltip logic (same as your good version)
  function attachSmartTooltip() {
    let tooltip = document.getElementById("fp-tooltip");
    if (tooltip) tooltip.remove();

    tooltip = document.createElement("div");
    tooltip.id = "fp-tooltip";

    const isDark =
      document.documentElement.dataset.theme === "dark" ||
      document.body.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const tooltipBg = isDark ? "#f5f5f5" : "#222";
    const tooltipColor = isDark ? "#111" : "#fff";
    const arrowColor = tooltipBg;

    Object.assign(tooltip.style, {
      position: "fixed",
      background: tooltipBg,
      color: tooltipColor,
      padding: "5px 9px",
      borderRadius: "4px",
      fontSize: "11px",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      zIndex: "999999",
      opacity: "0",
      transform: "translate(-50%, 0)",
      transition: "opacity 0.15s ease, transform 0.15s ease",
      border: `1px solid ${
        isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"
      }`,
    });

    document.body.appendChild(tooltip);

    const style = document.createElement("style");
    style.id = "fp-tooltip-style";
    document.head.appendChild(style);

    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest(".flatpickr-day[data-tooltip]");
      if (!el) {
        tooltip.style.opacity = "0";
        return;
      }

      const rect = el.getBoundingClientRect();
      tooltip.textContent = el.dataset.tooltip;
      const offset = 8;
      tooltip.style.display = "block";
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.bottom + offset}px`;
      tooltip.style.opacity = "1";

      const tooltipHeight = tooltip.offsetHeight || 20;
      let flip = false;
      if (rect.bottom + tooltipHeight + offset > window.innerHeight) {
        tooltip.style.top = `${rect.top - tooltipHeight - offset}px`;
        flip = true;
      }

      style.textContent = `
        #fp-tooltip::after {
          content: '';
          position: absolute;
          ${flip ? "bottom: -10px;" : "top: -10px;"}
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: ${
            flip
              ? `${arrowColor} transparent transparent transparent`
              : `transparent transparent ${arrowColor} transparent`
          };
        }
      `;
    });

    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(".flatpickr-day[data-tooltip]")) {
        tooltip.style.opacity = "0";
      }
    });
  }
}();


if (localStorage['ak-travel-days']) {
  const { flatpickrDate, usrInpDate } = JSON.parse(localStorage['ak-travel-days']);
  if ($travelDate) {
    $travelDate.value = flatpickrDate;
    if ($travelDate.nextElementSibling) $travelDate.nextElementSibling.value = usrInpDate;
  }
}

/*$mainForm[0].querySelector('input[type=submit]').addEventListener('click', async e => {
  e.preventDefault();

  if (!localStorage['ak-flatpickrDateObj']) {
    const $dateField = document.querySelector('.is_dates:not(.flatpickr-input)');
    highlight($dateField);
    return;
  }

  const { selectedDates, dateStr } = JSON.parse(localStorage['ak-flatpickrDateObj']);

  const minHrs = setMinHrs;
  processDatepickerClose(selectedDates, dateStr);

  $mainForm[0].requestSubmit();
  startCheckout();
});*/

$mainForm[0].querySelector('input[type=submit]').addEventListener('click', async e => {
  e.preventDefault();

  // --- 1. Date Picker Validation (Custom) ---
  if (!localStorage['ak-flatpickrDateObj']) {
    const $dateField = document.querySelector('.is_dates:not(.flatpickr-input)');
    highlight($dateField);
    return;
  }
   
  // --- 2. Required Field Validation (Native HTML) ---
  // Check if the form is valid. If it's not, the browser will highlight the required fields.
  if (!$mainForm[0].checkValidity()) {
    // If the form is invalid, we prevent further execution. 
    // We MUST call .reportValidity() to make the browser show the tooltips.
    $mainForm[0].reportValidity();
    return; 
  }

  // Retrieve and process the date data (Only runs if both checks pass)
  const { selectedDates, dateStr } = JSON.parse(localStorage['ak-flatpickrDateObj']);
  const minHrs = setMinHrs;
  processDatepickerClose(selectedDates, dateStr);

  // --- 3. Proceed to Checkout (Success) ---
  const $emailField = $mainForm[0].querySelector('input[type="email"]');
  const userData = gatherUserDetails($emailField);
  await startCheckout(userData); 
});

function gatherUserDetails(emailField) {
  const phoneNumber = localStorage['ak-phone-num'] ? localStorage['ak-phone-num'] : '';
  const userEmail = localStorage['ak-userMail'] ? localStorage['ak-userMail'] : emailField.value.trim();
  let userName = '';
  let firstName = '';
  let lastName = '';
  let arrivalDate = '';
  let departureDate = '';

  if (localStorage['ak-user-name']) {
    userName = localStorage['ak-user-name'];
    [ firstName, lastName ] = userName.split(/\s+/);
  }
  else {
    userName = userEmail.split('@')[0];
    firstName = userName;
  }
  
  if (localStorage['ak-travel-days']) {
    const savedDates = JSON.parse(localStorage['ak-travel-days']);
    const { flatpickrDate } = savedDates;
    [ arrivalDate, departureDate ] = flatpickrDate.split(/\s+to\s+/);
  }
  else if (localStorage['ak-flatpickrDateObj']) {
    const savedDates = JSON.parse(localStorage['ak-flatpickrDateObj']);
    const { dateStr } = savedDates;
    [ arrivalDate, departureDate ] = dateStr.split(/\s+to\s+/);
  }

  return { phoneNumber, userEmail, userName, firstName, lastName, arrivalDate, departureDate };
}

function highlight(inp) {
  inp.classList.add('highlight');
  inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(()=>inp.classList.remove('highlight'),2000);
}

function processDatepickerClose(selectedDates, dateStr) {
  // updatePricing(dateStr); // dynamic pricing
  // updateTravelDates(selectedDates);
  // appendTravelDates(selectedDates);
  // reinitWebflow();
  formatNSaveDates(selectedDates, dateStr);
}

// function updateTravelDates(selectedDates) {
// 	if (selectedDates.length < 2) return; 
  
// 	let arrival = selectedDates[0].toString().split('GMT')[0].trim();
//   let departure = selectedDates[1].toString().split('GMT')[0].trim();
//   arrival = formatDate(arrival);
//   departure = formatDate(departure);
//   const travelDates = `${arrival},${departure}`;
  
//   let redirectUrl = $mainForm.attr('redirect'); 
//   let dataRedirectUrl = $mainForm.attr('data-redirect'); 
//   redirectUrl = redirectUrl.replace(/\&travel_dates=(.*?)((?=\&)|)$/g,'');
//   dataRedirectUrl = dataRedirectUrl.replace(/\&travel_dates=(.*?)((?=\&)|)$/g,'');
//   redirectUrl = `${redirectUrl}&travel_dates=${travelDates}`;
//   dataRedirectUrl = `${dataRedirectUrl}&travel_dates=${travelDates}`;
//   $mainForm.attr('redirect', redirectUrl);
//   $mainForm.attr('data-redirect', dataRedirectUrl);
// }

// function formatDate(dateStr) {
//   const theDate = new Date(dateStr);
//   const month = (theDate.getMonth() + 1) < 10 ? `0${theDate.getMonth() + 1}` : theDate.getMonth() + 1;
//   const date = theDate.getDate() < 10 ? `0${theDate.getDate()}` : theDate.getDate();
//   const year = theDate.getFullYear();
//   return `${month}/${date}/${year}`;
// }
  
// function appendTravelDates(selectedDates) {
//   const arrival = selectedDates[0]?.toString().split('GMT')[0].trim();
//   const departure = selectedDates[1]?.toString().split('GMT')[0].trim();

//   const $arrivalEl = createEl('Arrival Date', formatDate(arrival));
//   let $departureEl;
//   if (departure) {
//     $departureEl = createEl('Departure Date', formatDate(departure));
//     $mainForm.append($arrivalEl, $departureEl);
//   }
//   else {
//     $mainForm.append($arrivalEl);
//   }
// }
  
// function createEl(name, val) {
//   const $inp = document.createElement('input');
//   $inp.setAttribute('type','hidden');
//   $inp.className = 'foxy-date-input';
//   $inp.setAttribute('name', name);
//   $inp.setAttribute('value', val);
//   return $inp;
// }

// dynamic pricing
// function updatePricing(dateStr) {
//   const price = getPricing(dateStr);
  
//   let redirectUrl = $mainForm.attr('redirect'); 
//   let dataRedirectUrl = $mainForm.attr('data-redirect'); 
//   const currentPrice = redirectUrl.match(/&price=(.*?)(?=&)/)[0].trim();
//   redirectUrl = redirectUrl.replace(currentPrice, `&price=${price}`);
//   dataRedirectUrl = dataRedirectUrl.replace(currentPrice, `&price=${price}`);

//   if (price == lessThan3WeeksPrice) {
//     const rushedName = `&name=Rush%20Delivery%20Tailored%20Plan`;
//     const currentName = redirectUrl.match(/&name=(.*?)(?=&)/)[0].trim();
//     redirectUrl = redirectUrl.replace(currentName, rushedName);
//     dataRedirectUrl = dataRedirectUrl.replace(currentName, rushedName);
//   }

//   $mainForm.attr('redirect', redirectUrl);
//   $mainForm.attr('data-redirect', dataRedirectUrl);
// }

/*function getPricing(dateStr) {

  const startDate = dateStr.split('to')[0].trim(); 
  const today = new Date(); 
  const days = Math.ceil( ( new Date(startDate).getTime() - today.getTime() ) / (1000 * 60 * 60 * 24) ); 
  const weeks = days / 7; 
  let price = basePrice;
  
  if (weeks < 3) {
    price = lessThan3WeeksPrice;
  }
      
  return price.toFixed(2);
}*/

function formatNSaveDates(selectedDates, dateStr) {
  const fromDate = new Date(selectedDates[0]);
  const toDate = new Date(selectedDates[1]);

  const startYr = fromDate.getFullYear();
  const endYr = toDate.getFullYear();
  const startMonth = appendZeroToSingleDigitDate(fromDate.getMonth()+1); //
  const endMonth = appendZeroToSingleDigitDate(toDate.getMonth()+1);
  const startDate = appendZeroToSingleDigitDate(fromDate.getDate());
  const endDate = appendZeroToSingleDigitDate(toDate.getDate());

  const fpStartDate = `${startYr}-${startMonth}-${startDate}`;
  const fpEndDate = `${endYr}-${endMonth}-${endDate}`;
  const flatpickrDate = `${fpStartDate} to ${fpEndDate}`;

  const usrInpDate = `${fromDate.toDateString().substring(0, 10)} to ${toDate.toDateString().substring(0, 10)}`;

  localStorage['ak-travel-days'] = JSON.stringify({ flatpickrDate, usrInpDate }); 
  
  const numberOfWeeks = getWeeks(dateStr);
  localStorage['ak-numberOfWeeks'] = numberOfWeeks;

  function appendZeroToSingleDigitDate(date) {
    return date < 10 ? `0${date}` : date;
  }
  
  function getWeeks(dateStr) {
    const startDate = dateStr.split('to')[0].trim(); 
    const today = new Date(); 
    const days = Math.ceil( ( new Date(startDate).getTime() - today.getTime() ) / (1000 * 60 * 60 * 24) ); 
    const weeks = Math.round(days / 7); 
    return weeks;
  }
}

// hotel autocomplete
!async function setupHotelAutocompleteInp() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
    componentRestrictions: {country: ['us']},
  });

  // document.body.appendChild(placeAutocomplete); 
  const $hotelWrap = document.querySelector('#ak-hotel-inp');
  $hotelWrap.appendChild(placeAutocomplete);

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-placeselect', async ({ place }) => {
    await place.fetchFields({
      fields: ['displayName', 'formattedAddress', 'location'],
    });

    const res = place.toJSON(); 
    const hotel = res.displayName;
    // console.log(res);

    localStorage['ak-hotel'] = hotel;
  });
}(); 

// function reinitWebflow() {
//   Webflow.destroy();
//   Webflow.ready();
//   Webflow.require('ix2').init();
// }



async function checkForCapacityOnDatePickerClose(dateArr, minHrs = setMinHrs) {
  const arrivalDate = processArrivalDate(dateArr);
  const { weeks } = getDaysNWeeksFromToday(arrivalDate);

  if (weeks <= rushOrderWeeks) {
    showWarning('This is a rush order! Needs to be delivered in 3 weeks or less.');
    return; 
  }

  // 🚀 Start loading spinner
  showLoading();

  try {
    const daysData = await fetchAllSheetDataDebounced();
    const todayEpoch = today.getTime();
    let msg = null;

    for (const day of daysData) {
      const { available, date, capacity } = day;
      if (!available || available.toLowerCase() !== 'true') continue;
      const dateEpoch = new Date(date).getTime();
      if (todayEpoch > dateEpoch || parseInt(capacity) < parseInt(minHrs)) continue;

      const { booked, max, ['no. of tasks']: noOfTasks } = day;
      msg = `${date} | ${capacity} capacity | ${booked} booked | ${noOfTasks} tasks`;
      break;
    }

    // ✅ Stop loading spinner
    closeLoading();

    if (!msg) {
      showError("Our queue is currently full for your travel dates. Please contact us at hello@askkhonsu.com for more info.");
      return null;
    } else {
      // showToast(`There’s capacity! \n${msg}`, 'success');
      // console.log(`There’s capacity! \n${msg}`, 'success');
      return msg;
    }
  } catch (error) {
    // 🧯 Always stop the loader on error
    closeLoading();
    showError('Something went wrong while checking capacity. Please try again.');
    console.error('Capacity Check Error:', error);
    return null;
  }

  function processArrivalDate(dateArr) {
    const date = dateArr[0];
    return new Date(date)?.toDateString() || 'No Date';
  }  

  function getDaysNWeeksFromToday(futureDate) {
    const today = new Date();
    const days = getNumberOfDaysBetweenDates(today, futureDate); 
    const weeks = Math.round(days / 7); 
    return { days, weeks }; 
  }

  function getNumberOfDaysBetweenDates(fromDate, toDate) {
    const fromDateTime = new Date(fromDate).getTime();
    const toDateTime = new Date(toDate).getTime();
    const oneDayMilliseconds = 1000 * 60 * 60 * 24;
    const days = Math.ceil( ( toDateTime - fromDateTime  ) / oneDayMilliseconds ); 
    return days;
  }
}





// ==============================
// Paginated Google Sheets Fetcher
// with: pagination + per-page cache + exponential backoff + debounce
// ==============================

// UTILITIES
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
function debounce(fn, delay = debounceDelay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(async () => {
        const result = await fn(...args);
        resolve(result);
      }, delay);
    });
  };
}

function cacheKeyForPage(pageNum) {
  return `${cacheKeyPrefix}-${sheetName}-p${pageNum}`;
}

function savePageCache(pageNum, data) {
  const item = { timestamp: Date.now(), data };
  try { sessionStorage.setItem(cacheKeyForPage(pageNum), JSON.stringify(item)); }
  catch (e) { console.warn('Could not cache page', pageNum, e); }
}

function getPageCache(pageNum) {
  try {
    const raw = sessionStorage.getItem(cacheKeyForPage(pageNum));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    return null;
  }
}

function isCacheFresh(cacheItem) {
  if (!cacheItem) return false;
  return (Date.now() - cacheItem.timestamp) < cacheDurationMs;
}

// Fetch with exponential backoff
async function fetchWithBackoff(url, retries = maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.warn(`Attempt ${attempt} failed for ${url}: ${err.message}`);
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      } else {
        throw err;
      }
    }
  }
}

// Build range for page (A{start}:F{end})
function buildRange(startRow, endRow, lastCol = 'F') {
  return `${sheetName}!A${startRow}:${lastCol}${endRow}`;
}

// Fetch a single page (rows startRow..endRow) with caching & fallback to cache
async function fetchSheetPage(pageNum, pageSizeLocal = pageSize) {
  const startRow = (pageNum - 1) * pageSizeLocal + 1; // 1-indexed
  const endRow = startRow + pageSizeLocal - 1;

  const range = buildRange(startRow, endRow);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;

  // Check cached page
  const cached = getPageCache(pageNum);
  const cacheFresh = isCacheFresh(cached);

  if (cacheFresh) {
    // console.log(`✅ Using fresh cache for page ${pageNum}`);
    return { rows: cached.data, cached: true, fresh: true };
  }

  // Not fresh -> attempt live fetch with backoff
  try {
    // console.log(`⏳ Fetching page ${pageNum} (${startRow}–${endRow})`);
    const json = await fetchWithBackoff(url);
    const rows = json.values || [];
    // Save cache (store raw rows; structuring happens after merging pages)
    savePageCache(pageNum, rows);
    return { rows, cached: false, fresh: true };
  } catch (err) {
    console.warn(`⚠️ Live fetch failed for page ${pageNum}: ${err.message}`);
    // Fall back to any cached data (even stale)
    if (cached?.data) {
      console.warn(`⚠️ Falling back to stale cache for page ${pageNum}`);
      return { rows: cached.data, cached: true, fresh: false };
    }
    // No cache => return null to indicate missing page
    console.error(`🚫 No cached data for page ${pageNum}.`);
    return { rows: null, cached: false, fresh: false };
  }
}

// Public function to fetch all pages (stops when page returns 0 rows)
// Returns structured array of objects (header-based mapping)
async function fetchAllSheetData({ pageSizeLocal = pageSize, maxPagesLocal = maxPages, lastCol = 'F' } = {}) {
  // We will collect pages (arrays of rows). Each page returns an array with rows in A..F
  const pages = [];
  let pageNum = 1;

  // We need to figure out header. We'll fetch page 1 even if cached, to obtain header.
  while (pageNum <= maxPagesLocal) {
    const pageRes = await fetchSheetPage(pageNum, pageSizeLocal);

    if (!pageRes || pageRes.rows === null) {
      // Missing page and no cache fallback -> stop loop
      console.warn(`Stopping at page ${pageNum} due to no data available (and no cache).`);
      break;
    }

    // If page has zero rows -> no more data
    if (pageRes.rows.length === 0) {
      // console.log(`Page ${pageNum} returned 0 rows — stopping pagination.`);
      break;
    }

    pages.push(pageRes.rows);

    // If the fetched page had fewer rows than pageSize, likely final page
    if (pageRes.rows.length < pageSizeLocal) {
      // console.log(`Page ${pageNum} is final page (rows < pageSize).`);
      break;
    }

    pageNum++;
  }

  // Merge pages into single rows array
  const mergedRows = pages.flat();

  if (!mergedRows || mergedRows.length === 0) {
    console.warn('No rows collected across pages.');
    return [];
  }

  // The very first row should be the header (assuming spreadsheet is contiguous)
  const [header, ...bodyRows] = mergedRows;

  // Filter out empty rows (all-empty)
  const filteredRows = bodyRows.filter(row =>
    row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
  );

  // Map rows to objects using header (lowercased keys)
  const structuredData = filteredRows.map(row => {
    const entry = {};
    header.forEach((key, idx) => {
      const k = String(key || '').toLowerCase().trim();
      entry[k] = row[idx] !== undefined ? row[idx] : '';
    });
    return entry;
  });

  return structuredData;
}



async function getUnavailableDates(minHrs = setMinHrs) {
  const daysData = await fetchAllSheetDataDebounced();
  const unavailable = [];

  for (const day of daysData) {
    const { available, date, capacity } = day;
    const capacityNum = parseInt(capacity);
    const dateObj = new Date(date);

    // ❌ Mark date as unavailable if not available or high demand
    if (!available || available.toLowerCase() !== 'true' || capacityNum < minHrs) {
      unavailable.push({
        date: dateObj,
        reason: capacityNum < minHrs ? 'High Demand' : 'Fully booked',
      });
    }
  }

  // console.log('❌ Unavailable Dates (from sheet):', unavailable);
  return unavailable;
}


}); // $(document).ready close



// Export (if using modules)
// export { fetchAllSheetDataDebounced as fetchSheetData };


// ✅ SweetAlert2 Modals and Toasts

function showModal({ title = '', text = '', icon = 'info', confirmText = 'OK', timer = null }) {
  Swal.fire({
    title,
    text,
    icon,
    confirmButtonText: confirmText,
    background: '#fff',
    color: '#333',
    confirmButtonColor: '#FF4500', // brand 
    showClass: {
      popup: 'animate__animated animate__fadeInDown'
    },
    hideClass: {
      popup: 'animate__animated animate__fadeOutUp'
    },
    timer,
    timerProgressBar: !!timer
  });
}

function showSuccess(message) {
  showModal({
    title: 'Success!',
    text: message,
    icon: 'success',
    confirmText: 'Great!'
  });
}

function showWarning(message) {
  showModal({
    title: 'Notice',
    text: message,
    icon: 'warning',
    confirmText: 'OK'
  });
}

function showError(message) {
  showModal({
    title: 'High Demand',
    text: message,
    icon: 'error',
    confirmText: 'Close'
  });
}

// 💬 Toast notifications
function showToast(message, icon = 'info') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e1e1e',
    color: '#fff',
  });
}

// 🔄 Loading Indicator
function showLoading(message = 'Checking availability...') {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
    background: '#fff',
    color: '#333',
  });
}

// ✅ Close loading state
function closeLoading() {
  Swal.close();
}

