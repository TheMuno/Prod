$(document).ready(()=>{
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
const setMinHrs = 10;
const today = new Date(); 

const $mainForm = $('#wf-form-Plan-My-Trip-Form');
const $travelDate = document.querySelector('[data-ak="user-travel-dates-trip-plan"]');
const basePrice = 49.99;
const lessThan3WeeksPrice = 64.99;

/*const fp = flatpickr($travelDate, {
  mode: 'range',
  altInput: true,
  enableTime: false,
  altFormat: 'D M j',
  dateFormat: 'Y-m-d',
  minDate: 'today',
  onOpen: (selectedDates, dateStr, instance) => {
    $mainForm[0].querySelectorAll('.foxy-date-input').forEach(inp => inp.remove());
  },
  onClose: (selectedDates, dateStr, instance) => {
    if (!selectedDates.length) return;
    const flatpickrDateObj = { selectedDates, dateStr }; 
    localStorage['ak-flatpickrDateObj'] = JSON.stringify(flatpickrDateObj);
    processDatepickerClose(selectedDates, dateStr);
  },
});*/

// Debounced public wrapper
const fetchAllSheetDataDebounced = debounce(fetchAllSheetData, debounceDelay);

const fp = flatpickr($travelDate, {
  mode: 'range',
  altInput: true,
  enableTime: false,
  altFormat: 'D M j',
  dateFormat: 'Y-m-d',
  // minDate: 'today',
  disable: [
    function(date) {
      return (date.getDay() === 0 || date.getDay() === 6); // return true to disable
    }
  ],

  // 🧩 Add dynamic unavailable days after loading
  async onReady(selectedDates, dateStr, instance) {
    const unavailableDates = await getUnavailableDates();

    // const arrivalDate = selectedDates[0];
    // const currentDay = new Date(arrivalDate).getDay();
    // const weekend = currentDay === 0 || currentDay === 6 ? true : false;
    // // if (weekend) {
    // if (currentDay === 0 || currentDay === 6) {
    //   unavailableDates.concat(arrivalDate);
    // }

    // console.log('selectedDates', selectedDates)
    // console.log('arrivalDate', arrivalDate)
    // console.log('currentDay', currentDay)
    // console.log('weekend', weekend)

    // Flatpickr “disable” expects an array of date objects
    instance.set('disable', unavailableDates);

    console.log('Flatpickr disabled dates loaded ✅');
  },

  onOpen(selectedDates, dateStr, instance) {
    $mainForm[0].querySelectorAll('.foxy-date-input').forEach(inp => inp.remove());
  },

  onClose(selectedDates, dateStr, instance) {
    if (!selectedDates.length) return;
    const flatpickrDateObj = { selectedDates, dateStr };
    localStorage['ak-flatpickrDateObj'] = JSON.stringify(flatpickrDateObj);
    processDatepickerClose(selectedDates, dateStr);
  },
});


if (localStorage['ak-travel-days']) {
  const { flatpickrDate, usrInpDate } = JSON.parse(localStorage['ak-travel-days']);
  $travelDate.value = flatpickrDate;
  $travelDate.nextElementSibling.value = usrInpDate;
}

$mainForm[0].querySelector('input[type=submit]').addEventListener('click', async e => {
  e.preventDefault();

  if (!localStorage['ak-flatpickrDateObj']) {
    const $dateField = document.querySelector('.is_dates:not(.flatpickr-input)');
    highlight($dateField);
    return;
  }

  const { selectedDates, dateStr } = JSON.parse(localStorage['ak-flatpickrDateObj']);

  const minHrs = setMinHrs;
  const capacity = await checkForCapacityOnDatePickerClose(selectedDates, minHrs); 
  if (!capacity) {
    // alert(`Sorry,\nThere's no ${minHrs}hrs capacity!`);
    // showError(`Our queue is currently full for your travel dates.\nPlease contact us at hello@askkhonsu.com for more info.`);
    const arrivalDate = new Date(selectedDates[0]).toDateString();
    showError(`Sorry our team is at full capacity for your arrival date: ${arrivalDate}. To be notified when capacity is free, send an email to hello@askkhonsu.com with subject "notify" and we will contact you when our team is free.`);
    return; 
  }
  else {
    console.log(`There's some capacity!\n${capacity}`);
  }

  processDatepickerClose(selectedDates, dateStr);

  $mainForm[0].requestSubmit();
});

function highlight(inp) {
  inp.classList.add('highlight');
  inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(()=>inp.classList.remove('highlight'),2000);
}

function processDatepickerClose(selectedDates, dateStr) {
  updatePricing(dateStr); // dynamic pricing
  updateTravelDates(selectedDates);
  appendTravelDates(selectedDates);
  reinitWebflow();
  formatNSaveDates(selectedDates, dateStr);
}

function updateTravelDates(selectedDates) {
	if (selectedDates.length < 2) return; 
  
	let arrival = selectedDates[0].toString().split('GMT')[0].trim();
  let departure = selectedDates[1].toString().split('GMT')[0].trim();
  arrival = formatDate(arrival);
  departure = formatDate(departure);
  const travelDates = `${arrival},${departure}`;
  
  let redirectUrl = $mainForm.attr('redirect'); 
  let dataRedirectUrl = $mainForm.attr('data-redirect'); 
  redirectUrl = redirectUrl.replace(/\&travel_dates=(.*?)((?=\&)|)$/g,'');
  dataRedirectUrl = dataRedirectUrl.replace(/\&travel_dates=(.*?)((?=\&)|)$/g,'');
  redirectUrl = `${redirectUrl}&travel_dates=${travelDates}`;
  dataRedirectUrl = `${dataRedirectUrl}&travel_dates=${travelDates}`;
  $mainForm.attr('redirect', redirectUrl);
  $mainForm.attr('data-redirect', dataRedirectUrl);
}

function formatDate(dateStr) {
  const theDate = new Date(dateStr);
  const month = (theDate.getMonth() + 1) < 10 ? `0${theDate.getMonth() + 1}` : theDate.getMonth() + 1;
  const date = theDate.getDate() < 10 ? `0${theDate.getDate()}` : theDate.getDate();
  const year = theDate.getFullYear();
  return `${month}/${date}/${year}`;
}
  
function appendTravelDates(selectedDates) {
  const arrival = selectedDates[0]?.toString().split('GMT')[0].trim();
  const departure = selectedDates[1]?.toString().split('GMT')[0].trim();

  const $arrivalEl = createEl('Arrival Date', formatDate(arrival));
  let $departureEl;
  if (departure) {
    $departureEl = createEl('Departure Date', formatDate(departure));
    $mainForm.append($arrivalEl, $departureEl);
  }
  else {
    $mainForm.append($arrivalEl);
  }
 }
  
function createEl(name, val) {
  const $inp = document.createElement('input');
  $inp.setAttribute('type','hidden');
  $inp.className = 'foxy-date-input';
  $inp.setAttribute('name', name);
  $inp.setAttribute('value', val);
  return $inp;
}

// dynamic pricing
function updatePricing(dateStr) {
  const price = getPricing(dateStr);
  
  let redirectUrl = $mainForm.attr('redirect'); 
  let dataRedirectUrl = $mainForm.attr('data-redirect'); 
  const currentPrice = redirectUrl.match(/&price=(.*?)(?=&)/)[0].trim();
  redirectUrl = redirectUrl.replace(currentPrice, `&price=${price}`);
  dataRedirectUrl = dataRedirectUrl.replace(currentPrice, `&price=${price}`);

  if (price == lessThan3WeeksPrice) {
    const rushedName = `&name=Rush%20Delivery%20Tailored%20Plan`;
    const currentName = redirectUrl.match(/&name=(.*?)(?=&)/)[0].trim();
    redirectUrl = redirectUrl.replace(currentName, rushedName);
    dataRedirectUrl = dataRedirectUrl.replace(currentName, rushedName);
  }

  $mainForm.attr('redirect', redirectUrl);
  $mainForm.attr('data-redirect', dataRedirectUrl);
}

function getPricing(dateStr) {

  const startDate = dateStr.split('to')[0].trim(); 
  const today = new Date(); 
  const days = Math.ceil( ( new Date(startDate).getTime() - today.getTime() ) / (1000 * 60 * 60 * 24) ); 
  const weeks = days / 7; 
  let price = basePrice;
  
  if (weeks < 3) {
    price = lessThan3WeeksPrice;
  }
      
  return price.toFixed(2);
}

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

function reinitWebflow() {
  Webflow.destroy();
  Webflow.ready();
  Webflow.require('ix2').init();
}







/*async function checkForCapacityOnDatePickerClose(dateArr, minHrs=setMinHrs) {
  const arrivalDate = processArrivalDate(dateArr);
  const { weeks } = getDaysNWeeksFromToday(arrivalDate);
  if (weeks <= rushOrderWeeks) {
    console.log('This is a rush order\nNeeds to be delivered in 3 weeks or less!');
    return; // only needs to check for capacity for normal orders
  }

  // 🚀 Start loading spinner
  showLoading();
    
  try {
  // const daysData = await getSheetData();
  // const daysData = await fetchGoogleSheetData();
  const daysData = await fetchAllSheetDataDebounced();
  const todayEpoch = today.getTime();  
  let msg;
  for (const day of daysData) {
      const { available, date, capacity } = day;
      if (!available || available.toLowerCase() !== 'true') continue;
      const dateEpoch  = new Date(date).getTime();
      if (todayEpoch > dateEpoch || parseInt(capacity) < parseInt(minHrs)) continue;

      const { booked, max, ['no. of tasks']:noOfTasks } = day;

      const dayInfo = `${date} | ${capacity} capacity | ${booked} booked | ${noOfTasks} tasks`;
      msg = `There's capacity!\n${dayInfo}`;
      break;
  }

  // ✅ Stop loading spinner
  closeLoading();

  return msg;
  } 
  catch (error) {
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
}*/

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
      console.log(`There’s capacity! \n${msg}`, 'success');
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
    console.log(`✅ Using fresh cache for page ${pageNum}`);
    return { rows: cached.data, cached: true, fresh: true };
  }

  // Not fresh -> attempt live fetch with backoff
  try {
    console.log(`⏳ Fetching page ${pageNum} (${startRow}–${endRow})`);
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
      console.log(`Page ${pageNum} returned 0 rows — stopping pagination.`);
      break;
    }

    pages.push(pageRes.rows);

    // If the fetched page had fewer rows than pageSize, likely final page
    if (pageRes.rows.length < pageSizeLocal) {
      console.log(`Page ${pageNum} is final page (rows < pageSize).`);
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
    // If date is marked unavailable or capacity is too low → disable it
    if (!available 
        || available.toLowerCase() !== 'true' 
        || capacityNum < minHrs) {
      unavailable.push(dateObj); // store as Date object
    }
  }

  console.log('❌ Unavailable Dates:', unavailable);
  return unavailable;
}


}); // $(document).ready close

/*async function getSheetData() {
  try {
    const response = await fetch(url);
    const data = await response.json();

    const rows = data.values || [];

    if (rows.length < 2) {
      console.warn('Not enough data rows found');
      return [];
    }

    // Extract header row
    const [header, ...bodyRows] = rows;

    // Filter out empty rows
    const filteredRows = bodyRows.filter(row =>
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    // Map rows to objects using headers as keys
    const structuredData = filteredRows.map(row => {
      const entry = {};
      header.forEach((key, index) => {
        key = key.toLowerCase();
        entry[key] = row[index] || ''; // fallback to empty string if cell is missing
      });
      return entry;
    });

    console.log('Structured Data:', structuredData);
    return structuredData;

  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return [];
  }
}*/


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

