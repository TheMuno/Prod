$(document).ready(()=>{
const spreadsheetId = '1Ef5djoE68lL_qn_Qk7PlRB676UdF-zLF43aerF4A5mE';
const apiKey = 'AIzaSyDQpFatuEeQMlVkMK8y4BjhVMH0dexgKeU';
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:F100?key=${apiKey}`;

async function getSheetData() {
  try {
    const response = await fetch(url);
    const data = await response.json();

    const rows = data.values || [];

    if (rows.length < 2) {
      console.warn('Not enough data rows found');
      return [];
    }

    // 1️⃣ Extract header row
    const [header, ...bodyRows] = rows;

    // 2️⃣ Filter out empty rows
    const filteredRows = bodyRows.filter(row =>
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    // 3️⃣ Map rows to objects using headers as keys
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
}

const rushOrderWeeks = 3;
const lowerLimitDaysNum = 15;
const setMinHrs = 8;
async function checkForCapacityOnDatePickerClose(dateArr, minHrs=setMinHrs) {
    const arrivalDate = processArrivalDate(dateArr);
    // $dateCreated.textContent = today.toDateString();
    // $arrivalDate.textContent = arrivalDate;

    const { weeks } = getDaysNWeeksFromToday(arrivalDate);
    if (weeks <= rushOrderWeeks) {
        alert('This is a rush order\nNeeds to be delivered in 3 weeks or less!');
        return; 
    }

    const lastViableDateToStartWork  = getLowerLimitDate(arrivalDate, lowerLimitDaysNum);    
    const numberOfDaysAvailableToWork = getNumberOfDaysBetweenDates(today, lastViableDateToStartWork);
    if (numberOfDaysAvailableToWork < 1) {
        alert(`No more available days!\nThe last viable date to start work is on ${lastViableDateToStartWork.toDateString()}`);
        return;
    }
    
    // $minHrsInp.value = minHrs;
    
    // $lastViableDate.textContent = lastViableDateToStartWork.toDateString();
    const todayDate = today.getDate();
    const tomorrow = new Date(new Date(today).setDate(todayDate + 1)).toDateString();
    // $dateRange.textContent = `${tomorrow} (tomorrow) to ${lastViableDateToStartWork.toDateString()} (${lowerLimitDaysNum} days to arrival date)`;
    // $daysNum.textContent = `${numberOfDaysAvailableToWork} days to delivery`;
    // $minHrsDisplay.textContent = minHrs;

    const daysData = await getSheetData();

    // let firstDaySet = false;
    const todayEpoch = today.getTime();
    // $dateOpeningsTextArea.value = '';

    let msg;
    for (const day of daysData) {
        const { available, date, capacity } = day;
        if (!available || available.toLowerCase() !== 'true') continue;
        const dateEpoch  = new Date(date).getTime();
        if (todayEpoch > dateEpoch || parseInt(capacity) < parseInt(minHrs)) continue;

        const { booked, max, ['no. of tasks']:noOfTasks } = day;

        const dayInfo = `${date} | ${capacity} capacity | ${booked} booked | ${noOfTasks} tasks`;
        msg = `There's capacity!\n${dayInfo}`;
        // $dateOpeningsTextArea.value = $dateOpeningsTextArea.value + '\n' + dayInfo; 

        // if (firstDaySet) break;
        // $firstAvailableDate.textContent = date;
        // $firstAvailableDateCapacity.textContent = capacity;
        // $firstAvailableDateBooked.textContent = booked;
        // $firstAvailableDateTasks.textContent = noOfTasks;
        // firstDaySet = true;
        break;
    }

    return msg;

    function getDaysNWeeksFromToday(futureDate) {
      const today = new Date();
      const days = getNumberOfDaysBetweenDates(today, futureDate); 
      const weeks = Math.round(days / 7); 
      return { days, weeks }; 
    }

    function getLowerLimitDate(theArrivalDate, lowerLimit) {
      const arrivalDate = new Date(theArrivalDate); 
      const lowerLimitDate = arrivalDate.setDate(arrivalDate.getDate() - lowerLimit);
      return new Date(lowerLimitDate);
    }

    function getNumberOfDaysBetweenDates(fromDate, toDate) {
      const fromDateTime = new Date(fromDate).getTime();
      const toDateTime = new Date(toDate).getTime();
      const oneDayMilliseconds = 1000 * 60 * 60 * 24;
      const days = Math.ceil( ( toDateTime - fromDateTime  ) / oneDayMilliseconds ); 
      return days;
    }
}





const $mainForm = $('#wf-form-Plan-My-Trip-Form');
const basePrice = 49.99;
const lessThan3WeeksPrice = 64.99;

const $travelDate = document.querySelector('[data-ak="user-travel-dates-trip-plan"]');
const fp = flatpickr($travelDate, {
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
});

if (localStorage['ak-travel-days']) {
  const { flatpickrDate, usrInpDate } = JSON.parse(localStorage['ak-travel-days']);
  $travelDate.value = flatpickrDate;
  $travelDate.nextElementSibling.value = usrInpDate;
}

$mainForm[0].querySelector('input[type=submit]').addEventListener('click', e => {
  e.preventDefault();

  if (!localStorage['ak-flatpickrDateObj']) {
    const $dateField = document.querySelector('.is_dates:not(.flatpickr-input)');
    highlight($dateField);
    return;
  }

  const { selectedDates, dateStr } = JSON.parse(localStorage['ak-flatpickrDateObj']);

  const minHrs = setMinHrs;
  const capacity = checkForCapacityOnDatePickerClose(dateArr, minHrs); 
  if (!capacity) {
    alert(`Sorry,\nThere's no ${minHrs}hrs capacity!`);
    return; 
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
  const arrival = selectedDates[0].toString().split('GMT')[0].trim();
  const departure = selectedDates[1].toString().split('GMT')[0].trim();

  const $arrivalEl = createEl('Arrival Date', formatDate(arrival));
  const $departureEl = createEl('Departure Date', formatDate(departure));

  $mainForm.append($arrivalEl, $departureEl);
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
});
