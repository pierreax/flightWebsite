$(document).ready(function () {
    console.log("Loaded Site");

    let selectedStartDate = ''; // Variable to store the selected date in flatpickr
    let selectedEndDate = ''; // Variable to store the selected end date in flatpickr
    let depDate_From = ''; // Variable to store the selected dep date from
    let depDate_To = ''; // Variable to store the selected dep date to
    let returnDate_From = ''; // Variable to store the selected return date from
    let returnDate_To = ''; // Variable to store the selected return date to

    // Function to format dates as needed
    function formatDate(dateObject) {
        if (!(dateObject instanceof Date) || isNaN(dateObject.getTime())) { // Check if the date is invalid
            console.error('Invalid date:', dateObject);
            return "NaN/NaN/NaN";
        }
        const day = dateObject.getDate().toString().padStart(2, '0');
        const month = (dateObject.getMonth() + 1).toString().padStart(2, '0'); // +1 because months are 0-based
        const year = dateObject.getFullYear();
        return `${day}/${month}/${year}`;
    }


    // Initialize Flatpickr
    const flatpickrInstance = flatpickr("#dateField", {
        altInput: true,
        mode: "range",
        altFormat: "F j, Y",
        dateFormat: "d-m-Y",
        minDate: "today",
        onChange: function(selectedDates, dateStr, instance) {
            console.log(selectedDates, dateStr);
            // Update the selected start and end dates
            selectedStartDate = selectedDates[0];
            console.log('Raw Start Date: ', selectedStartDate);
            depDate_From = formatDate(selectedStartDate);
            depDate_To = formatDate(selectedStartDate);
            console.log('Formatted Start dates: ',depDate_From, depDate_To);
            selectedEndDate = selectedDates.length === 2 ? selectedDates[1] : ''; // If one date is selected, selectedEndDate is null
            console.log('Raw Return Date: ',selectedEndDate);
            returnDate_From = formatDate(selectedEndDate);
            returnDate_To = formatDate(selectedEndDate);
            console.log('Formatted Return dates: ',returnDate_From, returnDate_To);
        }
    });

    // Listener for oneWayTrip switch changes
    $('#oneWayTrip').change(function() {
        if ($(this).is(':checked')) {
            console.log("One-way trip selected");
            // Change Flatpickr to single date selection mode
            flatpickrInstance.set('mode', 'single');
            selectedEndDate = null; // Clear the end date since it's a one-way trip
        } else {
            console.log("Return trip selected");
            // Change Flatpickr back to range selection mode
            flatpickrInstance.set('mode', 'range');
        }
    });

        // Listener for Flexible dates switch changes
    $('#flexibleDates').change(function() {
        if ($(this).is(':checked')) {
            console.log("Flexible dates selected");
        } else {
            console.log("Exact dates selected");
        }
    });




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

    function parseInputValue(value) {
        if (typeof value === 'string' && value === "NaN/NaN/NaN") {
            return "";  // Or handle the invalid date case as needed
        }
        if (isNaN(value)) {
            return "";
        }
        return value;
    }

    $('#suggestPriceBtn').on('click', function() {
        // Check if the travel dates are selected
        var travelDatesSelected = selectedStartDate && (selectedEndDate || $('#oneWayTrip').is(':checked'));
        if (!travelDatesSelected) {
            alert('Please select your travel dates.');
            flatpickrInstance.open(); // Open Flatpickr calendar
            return;
        }

        // Check if the maximum number of stops is filled
        var maxStops = $('#maxStops').val();
        if (maxStops === '') {
            alert('Please fill in the maximum number of layovers. For direct flights, use 0.');
            $('#maxStops').focus();
            return;
        }

        // Check if the number of passengers is filled
        var nbrPassengers = $('#nbrPassengers').val();
        if (nbrPassengers === '') {
            alert('Please fill in the number of passengers.');
            $('#nbrPassengers').focus();
            return;
        }

        adjustDatesForFlexibility(); // Adjust dates and get them formatted
        suggestPriceLimit(); // Run the suggest price limit function
    });






    // Function to make an API request to Tequila API and suggest a price limit
    async function suggestPriceLimit() {
        console.log("Sending Current Price request");

        const tequilaApiUrl = 'https://tequila-api.kiwi.com/v2/search';
        const tequilaApiKey = '-MP6Bhp2klZefnaDsuhlENip9FX5-0Kc';
        const origin = extractIATACode('iataCodeFrom');
        const destination = extractIATACode('iataCodeTo');
        const maxStops = parseInputValue(parseInt(document.getElementById('maxStops').value));
        const maxFlyDuration = parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value));
        const flightType = $('#oneWayTrip').is(':checked') ? 'one-way' : 'return';
        console.log(flightType);



        try {
            const params = new URLSearchParams({
                fly_from: origin,
                fly_to: destination,
                date_from: depDate_From,
                date_to: depDate_To,
                return_from: returnDate_From,
                return_to: returnDate_To,
                max_stopovers: maxStops,
                max_fly_duration: maxFlyDuration,
                adults: 1,
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


    // Function to adjust dates based on flexible date switch
    function adjustDatesForFlexibility() {
        // Clone the original dates to avoid modifying them directly
        let adjustedDepFromDate = new Date(selectedStartDate);
        let adjustedDepToDate = new Date(selectedStartDate);
        let adjustedReturnFromDate = selectedEndDate ? new Date(selectedEndDate) : null;
        let adjustedReturnToDate = selectedEndDate ? new Date(selectedEndDate) : null;
        console.log(adjustedDepFromDate, adjustedDepToDate, adjustedReturnFromDate, adjustedReturnToDate);

        if ($('#flexibleDates').is(':checked')) {
            console.log("Adjusting for flexible dates");

            // Adjust departure dates by subtracting and adding one day
            adjustedDepFromDate.setDate(adjustedDepFromDate.getDate() - 1);
            adjustedDepToDate.setDate(adjustedDepToDate.getDate() + 1);

            // Adjust return dates by subtracting and adding one day if return date is not null
            if (adjustedReturnFromDate && adjustedReturnToDate) {
                adjustedReturnFromDate.setDate(adjustedReturnFromDate.getDate() - 1);
                adjustedReturnToDate.setDate(adjustedReturnToDate.getDate() + 1);
            }
        } else {
            console.log("Using exact dates");
        }

        // Update global variables with the adjusted and formatted dates
        depDate_From = formatDate(adjustedDepFromDate);
        depDate_To = formatDate(adjustedDepToDate);
        returnDate_From = adjustedReturnFromDate ? formatDate(adjustedReturnFromDate) : '';
        returnDate_To = adjustedReturnToDate ? formatDate(adjustedReturnToDate) : '';
    }


    // Tool tip function
    document.addEventListener('DOMContentLoaded', function() {
        const helpBtn = document.getElementById('helpBtn');
        const tooltip = document.getElementById('tooltip');

        helpBtn.addEventListener('click', function() {
        console.log("Tool-tip button clicked.");
            // Toggle display of the tooltip on click
            if(tooltip.style.display === 'block') {
                tooltip.style.display = 'none';
            } else {
                tooltip.style.display = 'block';
            }
        });

        // Optional: Hide the tooltip when clicking anywhere else on the page
        document.addEventListener('click', function(e) {
        console.log("Tool-tip button hided.");

            if (e.target !== helpBtn) {
                tooltip.style.display = 'none';
            }
        }, true);
    });


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
        adjustDatesForFlexibility(); // Adjust dates and get them formatted
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
                depDateFrom: depDate_From,
                depDateTo: depDate_To,
                returnDateFrom: returnDate_From,
                returnDateTo: returnDate_To,
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




