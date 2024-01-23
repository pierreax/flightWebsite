$(document).ready(function () {
    console.log("Loaded Site!!");

    // Globally define return date variables within the document.ready scope
    let startDateReturn = '';
    let endDateReturn = '';


    // Initialize Flatpickr
    flatpickr("#dateFrom", {
        altInput: true,
        mode: "range",
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
    });

    // Set the 'min' attribute for date inputs to today's date to prevent past dates
    const today = new Date().toISOString().split('T')[0];
    $('#depDateFrom').attr('min', today);
    $('#depDateTo').attr('min', today);
    $('#returnDateFrom').attr('min', today);
    $('#returnDateTo').attr('min', today);

    // Event listener for departure date changes
    $('#depDateFrom').change(function () {
        const departureDate = $(this).val();
        $('#depDateTo').val(departureDate); // Copy value to depDateTo if needed
        $('#returnDateFrom').attr('min', departureDate);
        $('#returnDateTo').attr('min', departureDate);
    });

    // Event listener for return date from changes
    $('#returnDateFrom').change(function () {
        const returnDate = $(this).val();
        $('#returnDateTo').attr('min', returnDate); // Ensure returnDateTo is not before returnDateFrom
    });

    // Event listener for flexibleDates checkbox changes
    $('#flexibleDates').change(function () {
        updateDateFieldsBasedOnFlexibility();
    });

    // Event listener for oneWayTrip checkbox changes
    $('#oneWayTrip').change(function () {
        updateDateFieldsBasedOnTripType();
    });

    // Function to update date fields based on the flexibility selection
    function updateDateFieldsBasedOnFlexibility() {
        if ($('#flexibleDates').is(':checked')) {
            console.log("Flexible dates selected.");
            // Change labels for flexible dates
            $('#labelDepDateFrom').text('Departure From:');
            $('#labelDepDateTo').text('Departure To:').show();
            $('#depDateTo').show().attr('required', 'required');

            if (!$('#oneWayTrip').is(':checked')) {
                $('#labelReturnDateFrom').text('Return From:').show();
                $('#labelReturnDateTo').text('Return To:').show();
                $('#returnDateFrom').show().attr('required', 'required');
                $('#returnDateTo').show().attr('required', 'required');
            }
        } else {
            console.log("Exact dates selected.");
            // Change labels for exact dates
            $('#labelDepDateFrom').text('Departure:');
            $('#labelDepDateTo').hide();
            $('#depDateTo').hide().removeAttr('required');

            if (!$('#oneWayTrip').is(':checked')) {
                $('#labelReturnDateFrom').text('Return:').show();
                $('#returnDateTo').hide().removeAttr('required');
                $('#labelReturnDateTo').hide();
            }
        }
    }

    // Function to update date fields based on the trip type selection
    function updateDateFieldsBasedOnTripType() {
        if ($('#oneWayTrip').is(':checked')) {
            console.log("One-Way trip selected.");
            $('#labelReturnDateFrom').hide();
            $('#labelReturnDateTo').hide();
            $('#returnDateFrom').hide().removeAttr('required');
            $('#returnDateTo').hide().removeAttr('required');
        } else {
            console.log("Return trip selected.");
            if ($('#flexibleDates').is(':checked')) {
                $('#labelReturnDateFrom').text('Return Date From:').show();
                $('#labelReturnDateTo').text('Return Date To:').show();
                $('#returnDateFrom').show().attr('required', 'required');
                $('#returnDateTo').show().attr('required', 'required');
            } else {
                $('#labelReturnDateFrom').text('Return Date:').show();
                $('#returnDateFrom').show().attr('required', 'required');
                $('#returnDateTo').hide().removeAttr('required');
                $('#labelReturnDateTo').hide();
            }
        }
    }

    // Trigger change on page load to apply the correct visibility based on the default checkbox state
    $('#flexibleDates').change();
    $('#oneWayTrip').change();



    // Define the extractIATACode function here so it's available when suggestPriceLimit is called
    function extractIATACode(elementId) {
        const selectElement = document.getElementById(elementId);
        if (!selectElement) {
            console.error('Select element not found');
            return '';
        }
        const selectedOptionData = $(selectElement).select2('data');
        if (!selectedOptionData || !selectedOptionData.length) {
            console.error('No data found in Select2 for: ' + elementId);
            return '';
        }
        const selectedOptionText = selectedOptionData[0].text;
        const iataCode = selectedOptionText.split(' - ')[0];
        return iataCode.trim();
    }

    // Function to format dates as needed
    function formatDate(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) { // Check if the date is invalid
            console.error('Invalid date:', dateString);
            return "NaN/NaN/NaN";
        }
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${day}/${month}/${date.getFullYear()}`;
        return formattedDate;
    }

    function parseInputValue(value) {
        if (typeof value === 'string' && value === "NaN/NaN/NaN") {
            return "";  // Or handle the invalid date case as needed
        }
        if (isNaN(value)) {
            return "";
        }
        return value;
    }

    // Event listener for the Suggest Price Limit button
    $('#suggestPriceBtn').on('click', function() {
        suggestPriceLimit();
    });

    // Function to make an API request to Tequila API and suggest a price limit
    async function suggestPriceLimit() {
        console.log("Sending Current Price request");

        const tequilaApiUrl = 'https://tequila-api.kiwi.com/v2/search';
        const tequilaApiKey = '-MP6Bhp2klZefnaDsuhlENip9FX5-0Kc';

        const origin = extractIATACode('iataCodeFrom');
        const destination = extractIATACode('iataCodeTo');
        const startDate = formatDate(document.getElementById('depDateFrom').value);
        const endDate = formatDate(document.getElementById('depDateTo').value);
        const maxStops = parseInputValue(parseInt(document.getElementById('maxStops').value));
        const maxFlyDuration = parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value));
        const nbrPassengers = parseInputValue(parseInt(document.getElementById('nbrPassengers').value));
        const flightType = $('#oneWayTrip').is(':checked') ? 'one-way' : 'return';

        startDateReturn = '';  // Reset the values
        endDateReturn = '';

        // Only process return dates if the flight type is not one-way
        console.log(flightType);
        if (flightType !== 'one-way') {
            console.log("Return flight price check");
            startDateReturn = formatDate(document.getElementById('returnDateFrom').value);
            endDateReturn = formatDate(document.getElementById('returnDateTo').value);
            console.log(startDateReturn)
            console.log(endDateReturn)
        }

        try {
            const params = new URLSearchParams({
                fly_from: origin,
                fly_to: destination,
                date_from: startDate,
                date_to: endDate,
                return_from: startDateReturn,
                return_to: endDateReturn,
                max_stopovers: maxStops,
                max_fly_duration: maxFlyDuration,
                adults: nbrPassengers,
                curr: 'NOK',
                limit: 1
            });

            console.log('Tequila Search Params: ',params.toString());

            const response = await fetch(`${tequilaApiUrl}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'apikey': tequilaApiKey
                }
            });

            const currentPriceData = await response.json();
            console.log('Tequila API response:', currentPriceData);
            const suggestedPriceLimit = calculateSuggestedPriceLimit(currentPriceData);

            if (suggestedPriceLimit === 0) {
                alert("No flight available for the given parameters. Please consider increasing the maximum number of stops, flight duration or changing the dates.");
                document.getElementById('maxStops').focus();
                document.getElementById('maxStops').style.borderColor = 'red';
            } else {
                document.getElementById('maxPricePerPerson').value = suggestedPriceLimit;
            }

        } catch (error) {
            console.error('Error fetching data from Tequila API:', error);
        }
    }

    // Example function to calculate suggested price limit
    function calculateSuggestedPriceLimit(currentPriceData) {
        if (currentPriceData && currentPriceData.data && currentPriceData.data.length > 0) {
            const firstItem = currentPriceData.data[0];
            return firstItem.price;
        } else {
            return 0; // Handle the case where the data array is empty or doesn't exist
        }
    }

    // Function to populate a dropdown with options using Select2
    function populateDropdownWithSelect2(selectElement, data) {
        $(selectElement).select2({
            data: Object.keys(data).map(iata => ({
                id: iata,
                text: `${iata} - ${data[iata]}`
            })),
            placeholder: 'Start typing to search...',
            allowClear: true,
            width: '100%'
        });
    }

    // Function to read data from the "airports.txt" file
    async function readAirportsData() {
        try {
            const response = await fetch('airports.txt');
            const text = await response.text();

            // Split text into lines and create a dictionary
            const airportLines = text.split('\n');
            const airportData = {};

            airportLines.forEach(line => {
                const [iata, city] = line.split(' - ');
                if (iata && city) {
                    airportData[iata.trim()] = city.trim();
                }
            });

            return airportData;

        } catch (error) {
            console.error('Error reading airports data:', error);
            return {};
        }
    }

    // Initialize Select2 for the "IATA Code From" and "IATA Code To" fields
    $('#iataCodeFrom, #iataCodeTo').select2({
        placeholder: 'Start typing to search...',
        allowClear: true,
        width: '100%'
    });

    // Copy value from depDateFrom to depDateTo when depDateFrom changes
    $('#depDateFrom').change(function() {
        const departureDate = $(this).val();
        $('#depDateTo').val(departureDate);
    });

    // Copy value from returnDateFrom to returnDateTo when returnDateFrom changes
    $('#returnDateFrom').change(function() {
        const returnDate = $(this).val();
        $('#returnDateTo').val(returnDate);
    });

    // Additional code to focus on the search field when Select2 is opened
    $(document).on('select2:open', () => {
        document.querySelector('.select2-search__field').focus();
    });

    // Populate the IATA Code From and IATA Code To dropdowns with Select2
    readAirportsData().then(airportData => {
        populateDropdownWithSelect2('#iataCodeFrom', airportData);
        populateDropdownWithSelect2('#iataCodeTo', airportData);

        // Set default values for "From" and "To" fields
        $('#iataCodeFrom').val('OSL').trigger('change');
        $('#iataCodeTo').val('PMI').trigger('change');
    });

    // Form submission event listener
    document.getElementById('sheetyForm').addEventListener('submit', function (event) {
        event.preventDefault();


        // Function to generate a unique token for each submission
        function generateToken() {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            } else {
                return new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
            }
        }

        const sheetyApiUrl = 'https://api.sheety.co/f3a65c5d3619ab6b57dcfe118df98456/flightDeals/prices';

        let formData = {
            price: {
                iataCodeFrom: extractIATACode('iataCodeFrom'),
                iataCodeTo: extractIATACode('iataCodeTo'),
                flightType: $('#oneWayTrip').is(':checked') ? 'one-way' : 'return',
                maxPricePerPerson: document.getElementById('maxPricePerPerson').value,
                maxStops: parseInputValue(parseInt(document.getElementById('maxStops').value)),
                nbrPassengers: parseInputValue(parseInt(document.getElementById('nbrPassengers').value)),
                depDateFrom: formatDate(document.getElementById('depDateFrom').value),
                depDateTo: formatDate(document.getElementById('depDateTo').value),
                returnDateFrom: formatDate(document.getElementById('returnDateFrom').value),
                returnDateTo: formatDate(document.getElementById('returnDateTo').value),
                maxFlightDuration: parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value)),
                email: document.getElementById('email').value,
                token: generateToken(),
                lastFetchedPrice: 0
            }
        };

        console.log('Sending data to Sheety:', formData);

        fetch(sheetyApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(json => {
            console.log('Sheety API response:', json.price);

            // Show submission message
            document.getElementById('submissionMessage').style.display = 'block';

            // Clear form fields
            document.getElementById('sheetyForm').reset();

            // Hide message after a few seconds (adjust as needed)
            setTimeout(function () {
                document.getElementById('submissionMessage').style.display = 'none';
            }, 3000);

            // Show browser alert
            alert('Thank you for your submission! We will check prices daily and let you know when we find a matching flight!');
            // Reset default values for "From" and "To" fields
            $('#iataCodeFrom').val('OSL').trigger('change');
            $('#iataCodeTo').val('PMI').trigger('change');
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
});
