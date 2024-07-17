$(document).ready(function () {
    console.log("Loaded Site");


    // Function to parse query parameters
    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const queryParams = {};
        for (const [key, value] of params.entries()) {
            queryParams[key] = value;
        }
        return queryParams;
    }


    let selectedStartDate = ''; // Variable to store the selected date in flatpickr
    let selectedEndDate = ''; // Variable to store the selected end date in flatpickr
    let depDate_From = ''; // Variable to store the selected dep date from
    let depDate_To = ''; // Variable to store the selected dep date to
    let returnDate_From = ''; // Variable to store the selected return date from
    let returnDate_To = ''; // Variable to store the selected return date to
    let globalTequilaResponse = null; // Global variable to store the raw JSON response from Tequila API
    let airlinesDict = {};     // Global variable to store airline data for lookup
    let city = '';  // Global variable to store the City that the user is broswing from to set iataCodeFrom


    // Async function to fetch and store airline names at the start
    async function fetchData() {
        airlinesDict = await readAirlinesData();
        // Any other operations that need to wait for airlinesDict to be populated
    }

    fetchData(); // Call the async function


    // Currencies based on IP-location
    const defaultCurrencies = {
        'SE': 'SEK',
        'US': 'USD',
        'GB': 'GBP',
        'NO': 'NOK',
        'DK': 'DKK'
        // ... other countries and their default currencies
    };

    // Currencies and City based on IP-location
    $.get('https://api.ipgeolocation.io/ipgeo?apiKey=420e90eecc6c4bb285f238f38aea898f', function(response) {
        const countryCode = response.country_code2;
        city = response.city;
        const defaultCurrency = defaultCurrencies[countryCode];
        if (defaultCurrency) {
            $('#currency').val(defaultCurrency);
        }

        // Now fetch the IATA code using the Tequila API
        fetchClosestAirport(city);
    });

            

    // Function to fetch the closest airport based on City
    function fetchClosestAirport(city) {
        console.log('Searching closest airport to:', city);
        const url = `https://tequila-api.kiwi.com/locations/query?term=${encodeURIComponent(city)}&location_types=airport&limit=1`;
        const options = {
            method: 'GET',
            headers: {
                'apikey': 'mzfTu9SKWJUZBoKYr_u5sDGp6CxqWk7v'
            }
        };
    
        fetch(url, options)
            .then(response => response.json())
            .then(data => {
                if (data.locations && data.locations.length > 0) {
                    const airportIATA = data.locations[0].code;
                    console.log('Closest airport IATA code:', airportIATA);
                    $('#iataCodeFrom').val(airportIATA).trigger('change');
                } else {
                    console.log('No airport found for this city:', city);
                }
            })
            .catch(error => {
                console.error('Error fetching airport data:', error);
            });
    }


    // Attach the click event handler to the switch icon
    $('.switch-icon-container').on('click', function() {
        switchIATACodes();
    });

    function switchIATACodes() {
        let fromCode = $('#iataCodeFrom').val();
        let toCode = $('#iataCodeTo').val();
        $('#iataCodeFrom').val(toCode).trigger('change');
        $('#iataCodeTo').val(fromCode).trigger('change');
    }
    
    // Initialize Outbound Time Range Slider
    var outboundSlider = document.getElementById('outbound-timeRangeSlider');
    noUiSlider.create(outboundSlider, {
        start: [0, 24], // Example initial range
        connect: true,
        range: {
            'min': 0,
            'max': 24
        },
        step: 1,
        format: wNumb({
            decimals: 0,
            postfix: ':00'
        }),
        tooltips: false,
    });
    outboundSlider.noUiSlider.on('update', function(values, handle) {
        document.getElementById('outboundTimeStartDisplay').innerHTML = values[0];
        document.getElementById('outboundTimeEndDisplay').innerHTML = values[1];
    });

    // Initialize Inbound Time Range Slider
    var inboundSlider = document.getElementById('inbound-timeRangeSlider');
    noUiSlider.create(inboundSlider, {
        start: [0, 24], // Example initial range
        connect: true,
        range: {
            'min': 0,
            'max': 24
        },
        step: 1,
        format: wNumb({
            decimals: 0,
            postfix: ':00'
        }),
        tooltips: false,
    });
    inboundSlider.noUiSlider.on('update', function(values, handle) {
        document.getElementById('inboundTimeStartDisplay').innerHTML = values[0];
        document.getElementById('inboundTimeEndDisplay').innerHTML = values[1];
    });

    // Hide the Advanced Settings toggle initially
    $('#advancedSettingsToggle').hide();

    // Advanced settings section
    document.getElementById('advancedSettingsToggle').addEventListener('click', function() {
        var advancedSettings = document.getElementById('advancedSettings');
        var toggleButton = document.getElementById('advancedSettingsToggle');
        
        if (advancedSettings.style.display === 'none' || !advancedSettings.style.display) {
            advancedSettings.style.display = 'block';
            toggleButton.classList.add('expanded'); // Add the 'expanded' class
            $('#excludeAirlines').select2({
                placeholder: 'Select airlines to exclude',
                allowClear: true
            });

        } else {
            advancedSettings.style.display = 'none';
            toggleButton.classList.remove('expanded'); // Remove the 'expanded' class
        }
    });
    
    

    // Tool tip function
    $('#helpBtn').on('click', function(event) {
        const tooltip = document.getElementById('tooltip');
        console.log("Tool-tip button clicked.");
        // Toggle display of the tooltip on click
        if (tooltip.style.display === 'block') {
            tooltip.style.display = 'none';
        } else {
            tooltip.style.display = 'block';
        }
        // Stop the event from propagating to the parent button
        event.stopPropagation();
    });

    // Optional: Hide the tooltip when clicking anywhere else on the page
    $(document).on('click', function(e) {
        const helpBtn = document.getElementById('helpBtn');
        const tooltip = document.getElementById('tooltip');
        if (!helpBtn.contains(e.target) && !tooltip.contains(e.target)) {
            tooltip.style.display = 'none';
        }
    });


    function formatDate(dateObject) {
        if (!dateObject || !(dateObject instanceof Date) || isNaN(dateObject.getTime())) {
            console.error('Invalid date:', dateObject);
            return ""; // Return an empty string or some placeholder text as appropriate
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

    $('#oneWayTrip').change(function() {
        if ($(this).is(':checked')) {
            console.log("One-way trip selected");
            // Hide the inbound slider
            $('#inbound-timeRangeSlider').hide();
            $('#inbound-timeRangeDisplay').hide();
            // Change the text for the outbound time display to "Departure time" but keep the current time display
            $('#outbound-timeRangeDisplay').html('Departure time: <span id="outboundTimeStartDisplay"></span> - <span id="outboundTimeEndDisplay"></span>');
            // Update the time display spans with the current values
            var outboundStart = outboundSlider.noUiSlider.get()[0];
            var outboundEnd = outboundSlider.noUiSlider.get()[1];
            $('#outboundTimeStartDisplay').text(outboundStart);
            $('#outboundTimeEndDisplay').text(outboundEnd);
            // Change Flatpickr to single date selection mode
            flatpickrInstance.set('mode', 'single');
            selectedEndDate = null; // Clear the end date since it's a one-way trip
            returnDate_From = ''; // Clear the formatted return date
            returnDate_To = ''; // Clear the formatted return date
            flatpickrInstance.clear(); // This clears the selection, you may want to re-select the start date after this
            if (selectedStartDate) {
                flatpickrInstance.setDate(selectedStartDate, true); // Set the date to the previously selected start date
            }
        } else {
            console.log("Return trip selected");
            // Show the inbound slider and revert the text
            $('#inbound-timeRangeSlider').show();
            $('#inbound-timeRangeDisplay').show();
            $('#outbound-timeRangeDisplay').html('Outbound departure time: <span id="outboundTimeStartDisplay"></span> - <span id="outboundTimeEndDisplay"></span>');
            // Update the time display spans with the current values to ensure they remain accurate
            var outboundStart = outboundSlider.noUiSlider.get()[0];
            var outboundEnd = outboundSlider.noUiSlider.get()[1];
            $('#outboundTimeStartDisplay').text(outboundStart);
            $('#outboundTimeEndDisplay').text(outboundEnd);
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

    // When the value of origin (iataCodeFrom) changes
    $('#iataCodeFrom').on('change', function() {
        // Clear selections in the "Exclude Airlines" dropdown
        $('#excludeAirlines').val(null).trigger('change');
        $('#excludeAirlines').select2({
            placeholder: 'Select airlines to exclude',
            allowClear: true
        });

        // Optionally: Remove all options from the dropdown if you want to start fresh
        $('#excludeAirlines').empty().trigger('change');
        $('#excludeAirlines').select2({
            placeholder: 'Select airlines to exclude',
            allowClear: true
        });

        // Note: You can reinitialize or update the dropdown with any default options here if needed
    });

    // When the value of destination (iataCodeTo) changes
    $('#iataCodeTo').on('change', function() {
        // Clear selections in the "Exclude Airlines" dropdown
        $('#excludeAirlines').val(null).trigger('change');

        // Optionally: Remove all options from the dropdown if you want to start fresh
        $('#excludeAirlines').empty().trigger('change');

        // Note: You can reinitialize or update the dropdown with any default options here if needed
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
        const iataCode = selectedOptionText.split(' - ')[0].trim();
        const containsAllAirports = selectedOptionText.toLowerCase().includes("all airports");

        // If the Aiport Name contains All Airports we need to add city: so that we can search all Airports in the region
        if (containsAllAirports) {
            console.log('Adding city: in front of IATA: ',iataCode)
            return `city:${iataCode}`;
        } else {
            console.log('Returning plain IATA: ', iataCode)
            return iataCode;
        }
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

        // Check if the duration field is filled, only if direct flights only is not enabled
        if (!$('#directFlight').is(':checked')) {
            var maxTravelDuration = $('#maxFlightDuration').val();
            if (maxTravelDuration === '') {
                alert('Please fill in Travel duration (max).');
                $('#maxFlightDuration').focus();
                return;
            }
        }

        adjustDatesForFlexibility(); // Adjust dates and get them formatted
        suggestPriceLimit(); // Run the suggest price limit function
    });

    // Direct-flight only button toggle function
    $('#directFlight').change(function() {
        if ($(this).is(':checked')) {
            console.log("Direct flights only enabled");
            $('#maxStops').prop('disabled', true).val('0').addClass('disabled-input');
            $('#maxFlightDuration').prop('disabled', true).val('').addClass('disabled-input');
            console.log("Max stops input disabled, set to 0, and styled as disabled");
        } else {
            console.log("Direct flights only disabled");
            $('#maxStops').prop('disabled', false).val('').removeClass('disabled-input'); // Clear value when direct flights is unchecked
            $('#maxFlightDuration').prop('disabled', false).val('').removeClass('disabled-input');
            console.log("Max stops input enabled, cleared, and styled as normal");
        }
    });
    
    
    
    async function suggestPriceLimit() {
        console.log("Sending Current Price request");
        $('.loader').show(); // Show the loading icon
    
        // Check the state of the switch to determine the mode for airlines inclusion or exclusion
        let airlineModeSwitchState = $('#airlineModeSwitch').is(':checked');
    
        const requestData = {
            origin: extractIATACode('iataCodeFrom'),
            destination: extractIATACode('iataCodeTo'),
            dateFrom: depDate_From,
            dateTo: depDate_To,
            returnFrom: returnDate_From,
            returnTo: returnDate_To,
            maxStops: parseInt($('#maxStops').val()),
            maxFlyDuration: parseFloat($('#maxFlightDuration').val()),
            flightType: $('#oneWayTrip').is(':checked') ? 'one-way' : 'return',
            currency: $('#currency').val(),
            dtime_from: outboundSlider.noUiSlider.get()[0],
            dtime_to: outboundSlider.noUiSlider.get()[1],
            ret_dtime_from: $('#oneWayTrip').is(':checked') ? '' : inboundSlider.noUiSlider.get()[0],
            ret_dtime_to: $('#oneWayTrip').is(':checked') ? '' : inboundSlider.noUiSlider.get()[1],
            select_airlines: $('#excludeAirlines').val().join(','),
            select_airlines_exclude: !airlineModeSwitchState // Set based on the switch state
        };
    
        try {
            const response = await fetch('https://flightwebsiteapp.azurewebsites.net/api/TequilaProxy?code=GhYsupW4LCOGgGU3la2TWS88HV3_O34Z7CpZvQAWx1UVAzFugvTJJA==', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(requestData)
            });
    
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
    
            const tequilaResponse = await response.json();
            console.log('Raw response from Tequila API:', tequilaResponse);
    
            // Store the raw response globally for later use
            globalTequilaResponse = tequilaResponse;
            console.log('Raw response from Tequila API:', tequilaResponse);
    
            if (tequilaResponse.data && tequilaResponse.data.length > 0) {
                // Since the response is sorted, the first flight has the lowest price
                const lowestPriceFlight = tequilaResponse.data[0];
                const roundedPrice = Math.ceil(lowestPriceFlight.price); // Round up the price
                $('#maxPricePerPerson').val(roundedPrice);
    
                // Extract unique airlines from the response to update the dropdown
                const uniqueAirlines = [...new Set(tequilaResponse.data.flatMap(flight => flight.airlines))];
                updateExcludedAirlinesDropdown(uniqueAirlines);
    
                // Enable the Submit button since a matching flight was found
                $('#submitFormButton').prop('disabled', false);
                // Show the Advanced Settings label after suggestPriceLimit is executed
                $('#advancedSettingsToggle').show();
            } else {
                alert("No flights available for the given parameters. Please adjust your search criteria.");
            }
    
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('There was an error processing your request. Please try again later.');
        } finally {
            $('.loader').hide(); // Hide the loading icon once processing is complete
        }
    }
    
    
    // This revised version uses the airlinesDict to display names but stores codes as values.
    async function updateExcludedAirlinesDropdown(airlines) {
        // Clear the current options in the dropdown
        $('#excludeAirlines').empty();

        // Add new options from the response, mapping codes to names for display
        airlines.forEach(code => {
            const airlineName = airlinesDict[code] || code; // Use the airline name if available, otherwise the code
            $('#excludeAirlines').append(new Option(airlineName, code)); // Here code is the value
        });
        
        // Reinitialize the Select2 component to update its options
        $('#excludeAirlines').select2({
            placeholder: 'Select airlines to exclude',
            allowClear: true
        });
    }


    // Track the mode based on the switch's position
    let airlineSelectionMode = false; // False for exclude mode, true for include mode

    // Initialize airlines dropdown as "Exclude Airlines"
    $('#excludeAirlines').select2({
        placeholder: 'Select airlines to exclude',
        allowClear: true
    });

    // Assuming airlineSelectionMode is tracked by the switch's checked state
    $('#airlineModeSwitch').change(function() {
        airlineSelectionMode = this.checked;
        
        // Update the placeholder text based on the switch's state
        var newPlaceholder = airlineSelectionMode ? 'Select airlines to include' : 'Select airlines to exclude';
        $('#excludeAirlines').select2('destroy').select2({
            placeholder: newPlaceholder,
            allowClear: true
        });

        if (airlineSelectionMode) {
            // Select all airlines when in include mode
            var allAirlineIds = $('#excludeAirlines option').map(function() { return this.value }).get();
            $('#excludeAirlines').val(allAirlineIds).trigger('change');
        } else {
            // Clear the selection when switching back to exclude mode
            $('#excludeAirlines').val(null).trigger('change');
        }

        // Call updatePriceBasedOnSelection to adjust the price field according to the new mode and selected airlines
        updatePriceBasedOnSelection();
    });



    // Add an event listener to the "excludeAirlines" dropdown
    $('#excludeAirlines').on('change', function() {
        updatePriceBasedOnSelection();
    });

    function updatePriceBasedOnSelection() {
        const selectedAirlines = $('#excludeAirlines').val();
        
        if (!globalTequilaResponse || !globalTequilaResponse.data) {
            console.log('No flight data available to filter.');
            return;
        }
    
        let filteredFlights;
        if (airlineSelectionMode) {
            // Include mode: keep flights operated exclusively by the selected airlines
            // Every airline in the flight must be in the selectedAirlines list.
            filteredFlights = globalTequilaResponse.data.filter(flight => 
                flight.airlines.every(airline => selectedAirlines.includes(airline))
            );
        } else {
            // Exclude mode: remove flights that include any of the selected airlines
            filteredFlights = globalTequilaResponse.data.filter(flight =>
                !flight.airlines.some(airline => selectedAirlines.includes(airline))
            );
        }
    
        if (filteredFlights.length > 0) {
            const lowestPrice = filteredFlights[0].price;
            const roundedPrice = Math.ceil(lowestPrice); // Round up the price
            $('#maxPricePerPerson').val(roundedPrice);
        } else {
            $('#maxPricePerPerson').val(''); // Clear the price field
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


    // Function to calculate suggested price limit
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

    // Function to read data from the "airline_data.txt" file
    async function readAirlinesData() {
        try {
            const response = await fetch('airline_data.txt');
            const data = await response.json();
    
            // Convert array to a dictionary for easy lookup, adjusted for the provided data structure
            const airlinesDict = {};
            data.forEach(airline => {
                // Use 'code' as the key since the data structure has 'code' instead of 'iata'
                airlinesDict[airline.code] = airline.name;
            });
    
            return airlinesDict;
    
        } catch (error) {
            console.error('Error reading airlines data:', error);
            return {};
        }
    }
    

    // Initialize Select2 for the "IATA Code From" and "IATA Code To" fields
    $('#iataCodeFrom, #iataCodeTo').select2({
        placeholder: 'Start typing to search...',
        allowClear: true,
        width: '100%'
    });


    // Initialize Select2 for the "Exclude Airlines" dropdown
    $('#excludeAirlines').select2({
        width: '100%', // Ensures the dropdown matches the width of its container
        placeholder: 'Select airlines to exclude', // Placeholder text when nothing is selected
        allowClear: true // Allows users to clear their selection
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

        // Get query parameters
        const queryParams = getQueryParams();
        if (queryParams.iataCodeTo) {
            console.log("setting the iataCodeTo as " + queryParams.iataCodeTo);
            $('#iataCodeTo').val(queryParams.iataCodeTo).trigger('change');
            console.log($('#iataCodeTo').val());
        }
    });




    document.getElementById('sheetyForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    adjustDatesForFlexibility(); // Adjust dates and get them formatted
    $('.loader').show(); // Show the loader

    // Generate a unique token for each submission
    function generateToken() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        } else {
            return new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
        }
    }

    // Azure Function URL for the SheetyProxy
    const azureFunctionUrl = 'https://flightwebsiteapp.azurewebsites.net/api/SheetyProxy?code=yt4tWIWvuAOyUAXGb51D3loGGNcVNFrODYJaroWnBGGxAzFuxfFYvA==';

    // Check the state of the switch to determine the mode for airlines inclusion or exclusion
    let airlineModeSwitchState = $('#airlineModeSwitch').is(':checked');
    let selectedAirlines = $('#excludeAirlines').val();

    if (airlineModeSwitchState && (!selectedAirlines || selectedAirlines.length === 0)) {
        alert('Please include at least one airline in your search.');
        $('#excludeAirlines').select2('open'); // Focus on the airline selection
        $('.loader').hide(); // Hide the loader if validation fails
        return; // Exit the function to prevent submission
    }

    // Extract the times from the noUiSlider
    const outboundTimes = outboundSlider.noUiSlider.get();
    let inboundTimes = ['', '']; // Default to empty strings
    // Only get inbound times if it's not a one-way trip
    if (!$('#oneWayTrip').is(':checked')) {
        inboundTimes = inboundSlider.noUiSlider.get();
    }

    let formData = {
        price: {
            iataCodeFrom: extractIATACode('iataCodeFrom'),
            iataCodeTo: extractIATACode('iataCodeTo'),
            flightType: $('#oneWayTrip').is(':checked') ? 'one-way' : 'return',
            maxPricePerPerson: document.getElementById('maxPricePerPerson').value,
            currency: document.getElementById('currency').value,
            maxStops: parseInputValue(parseInt(document.getElementById('maxStops').value)),
            nbrPassengers: parseInputValue(parseInt(document.getElementById('nbrPassengers').value)),
            depDateFrom: depDate_From,
            depDateTo: depDate_To,
            returnDateFrom: returnDate_From,
            returnDateTo: returnDate_To,
            dtimeFrom: outboundTimes[0],
            dtimeTo: outboundTimes[1],
            retDtimeFrom: inboundTimes[0],
            retDtimeTo: inboundTimes[1],
            maxFlightDuration: parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value)),
            excludedAirlines: $('#excludeAirlines').val() ? $('#excludeAirlines').val().join(',') : '',
            exclude: !airlineModeSwitchState, // Set based on the switch state
            email: document.getElementById('email').value,
            token: generateToken(),
            lastFetchedPrice: 0,
            lowestFetchedPrice: 'null'
        }
    };

    console.log('Sending data to SheetyProxy:', formData);

    try {
        const response = await fetch(azureFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const json = await response.json();
        console.log('SheetyProxy response:', json);

        // Clear form fields
        document.getElementById('sheetyForm').reset();

        // After successful submission, explicitly clear the price field and any related global variables
        globalTequilaResponse = null; // Reset global variable holding the response
        $('#maxPricePerPerson').val(''); // Clear the price field


        // Show browser alert
        alert('Thank you for your submission! We will check prices daily and let you know when we find a matching flight!');
    } catch (error) {
        console.error('Error:', error);
        alert('There was an error processing your request. Please try again later.');
    } finally {
        $('.loader').hide(); // Hide the loader
    }

    // Reset default values for "From" and "To" fields
    $('#iataCodeFrom').val('OSL').trigger('change');
    $('#iataCodeTo').val('PMI').trigger('change');
    // Reset the outbound and inbound time range sliders to default values
    outboundSlider.noUiSlider.set([0, 24]);
    inboundSlider.noUiSlider.set([0, 24]);

    // Optionally, if you're changing the text dynamically based on the slider values,
    // reset those texts here as well
    document.getElementById('outboundTimeStartDisplay').innerHTML = '0:00';
    document.getElementById('outboundTimeEndDisplay').innerHTML = '24:00';
    document.getElementById('inboundTimeStartDisplay').innerHTML = '0:00';
    document.getElementById('inboundTimeEndDisplay').innerHTML = '24:00';
});

});




