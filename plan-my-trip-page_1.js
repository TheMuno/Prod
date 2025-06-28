$(document).ready(()=>{
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

$mainForm.querySelector('[data-ak="first-time-visitor"]').addEventListener('change', e => {
  if (!localStorage['ak-flatpickrDateObj']) return;
  const { selectedDates, dateStr } = JSON.parse(localStorage['ak-flatpickrDateObj']);
  processDatepickerClose(selectedDates, dateStr);
});

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
  const month = (theDate.getMonth() + 1) < 10 ? `0${theDate.getMonth() + 1}` :           theDate.getMonth() + 1;
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
  
  console.log('price', price)
  
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

  console.log('dateStr', dateStr)

  const startDate = dateStr.split('to')[0].trim(); 
  const today = new Date(); 
  const days = Math.ceil( ( new Date(startDate).getTime() - today.getTime() ) / (1000 * 60 * 60 * 24) ); 
  const weeks = days / 7; 
  let price = basePrice;
  
  console.log('days', days)
  console.log('weeks', weeks)

  if (weeks < 3) {
    price = lessThan3WeeksPrice;
  }
      
  return price.toFixed(2);
}

function formatNSaveDates(selectedDates, dateStr) {
  const fromDate = selectedDates[0];
  const toDate = selectedDates[1];
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
    console.log(res);

    localStorage['ak-hotel'] = hotel;
  });
}(); 

function reinitWebflow() {
  Webflow.destroy();
  Webflow.ready();
  Webflow.require('ix2').init();
}
});