const $j = jQuery.noConflict();

$j(document).ready(function () {
    console.log("Loaded Site");

    let airportData = {};

    // Function to parse query parameters
    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const queryParams = {};
        for (const [key, value] of params.entries()) {
            queryParams[key] = value;
        }
        return queryParams;
    }

    // Initialize the datalists for "IATA Code From" and "IATA Code To"
    readAirportsData().then(data => {
        airportData = data;
        populateDatalist('iataCodeFromList', airportData);
        populateDatalist('iataCodeToList', airportData);

        // Apply URL parameters after data is loaded
        const queryParams = getQueryParams();
        if (queryParams.iataCodeTo && airportData[queryParams.iataCodeTo]) {
            $j('#iataCodeTo').val(`$j{queryParams.iataCodeTo} - $j{airportData[queryParams.iataCodeTo]}`).trigger('change');
        }
    });

    // Function to read data from the "airports.txt" file
    async function readAirportsData() {
        try {
            const response = await fetch('airports.txt');
            const text = await response.text();

            // Split text into lines and create a dictionary
            const airportLines = text.split('\n');
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

    // Initialize jQuery UI Autocomplete for the "IATA Code From" and "IATA Code To" fields
    $j("#iataCodeFrom, #iataCodeTo").autocomplete({
        source: function(request, response) {
            const results = $j.map(airportData, function(value, key) {
                if (key.toLowerCase().startsWith(request.term.toLowerCase()) || value.toLowerCase().includes(request.term.toLowerCase())) {
                    return { label: `${key} - ${value}`, value: `${key} - ${value}` };
                }
            });
            response(results.slice(0, 10)); // Limit results to top 10 matches
        },
        minLength: 2 // Minimum length of characters before search starts
    });

    // Clear the IATA fields when clicked
    $j("#iataCodeFrom, #iataCodeTo").on('click', function() {
        $j(this).val('');
    });

    // Prevent default autocomplete behavior
    $j("#iataCodeFrom, #iataCodeTo").on('focus', function() {
        this.setAttribute('readonly', true);
        setTimeout(() => {
            this.removeAttribute('readonly');
        }, 100);
    });

    // Force remove the default dropdown arrow
    $j("#iataCodeFrom, #iataCodeTo").on("focus", function () {
        $j(this).attr("autocomplete", "off");
        $j(this).css("appearance", "none");
        $j(this).css("-webkit-appearance", "none");
        $j(this).css("-moz-appearance", "none");
        $j(this).css("-ms-appearance", "none");
    });

    let selectedStartDate = ''; // Variable to store the selected date in flatpickr
    let selectedEndDate = ''; // Variable to store the selected end date in flatpickr
    let depDate_From = ''; // Variable to store the selected dep date from
    let depDate_To = ''; // Variable to store the selected dep date to
    let returnDate_From = ''; // Variable to store the selected return date from
    let returnDate_To = ''; // Variable to store the selected return date to
    let globalTequilaResponse = null; // Global variable to store the raw JSON response from Tequila API
    let airlinesDict = {};     // Global variable to store airline data for lookup
    let city = '';  // Global variable to store the City that the user is browsing from to set iataCodeFrom
    let redirectEmail ='';
    let redirectIataCodeTo ='';
    let redirectCurrency ='';
    let redirectCity ='';
    let redirectUrl ='';

    // Async function to fetch and store airline names at the start
    async function fetchData() {
        airlinesDict = await readAirlinesData();
        // Any other operations that need to wait for airlinesDict to be populated
    }

    fetchData(); // Call the async function

    // Currencies and Location based on IP-location
    $j.get('https://api.ipgeolocation.io/ipgeo?apiKey=420e90eecc6c4bb285f238f38aea898f', function(response) {
        console.log(response);

        const currency = response.currency.code;
        const latitude = response.latitude;
        const longitude = response.longitude;

        console.log('Setting the currency to:', currency);

        // Update the currency based on the IP-response
        $j('#currency').val(currency).trigger('change');

        // Now fetch the IATA code using the Azure Function as a middle layer with coordinates
        fetchClosestAirport(latitude, longitude);
    });

    // Function to fetch the closest airport using coordinates through the backend
    async function fetchClosestAirport(latitude, longitude) {
        console.log('Searching closest airport to coordinates:', latitude, longitude);

        try {
            // Call the backend API endpoint
            const response = await fetch('/api/getClosestAirport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch airport data: ${response.status} - ${response.statusText}`);
            }

            const amadeusData = await response.json();
            const airports = amadeusData.data;

            if (airports && airports.length > 0) {
                const nearestAirport = airports[0];
                const airportIATA = nearestAirport.iataCode;
                console.log('Closest airport IATA code:', airportIATA);

                // Assuming airportData is an object mapping IATA codes to airport names
                $j('#iataCodeFrom').val(`${airportIATA} - ${airportData[airportIATA] || ''}`).trigger('change');
            } else {
                console.log('No airport found near this location');
            }
        } catch (error) {
            console.error('Error fetching closest airport:', error);
        }
    }



    // Attach the click event handler to the switch icon
    $j('.switch-icon-container').on('click', function() {
        switchIATACodes();
    });

    function switchIATACodes() {
        let fromCode = $j('#iataCodeFrom').val();
        let toCode = $j('#iataCodeTo').val();
        $j('#iataCodeFrom').val(toCode).trigger('change');
        $j('#iataCodeTo').val(fromCode).trigger('change');
    }

    // Function to extract IATA code
    function extractIATACode(inputId) {
        const inputValue = document.getElementById(inputId).value;
        if (!inputValue) {
            console.error('Input value not found');
            return '';
        }
        const iataCode = inputValue.split(' - ')[0].trim();
        const containsAllAirports = inputValue.toLowerCase().includes("all airports");

        // If the Airport Name contains All Airports we need to add city: so that we can search all Airports in the region
        if (containsAllAirports) {
            console.log('Adding city: in front of IATA: ', iataCode);
            return `city:${iataCode}`;
        } else {
            console.log('Returning plain IATA: ', iataCode);
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
    $j('#advancedSettingsToggle').hide();

    // Advanced settings section
    document.getElementById('advancedSettingsToggle').addEventListener('click', function() {
        var advancedSettings = document.getElementById('advancedSettings');
        var toggleButton = document.getElementById('advancedSettingsToggle');

        if (advancedSettings.style.display === 'none' || !advancedSettings.style.display) {
            advancedSettings.style.display = 'block';
            toggleButton.classList.add('expanded'); // Add the 'expanded' class
            $j('#excludeAirlines').select2({
                placeholder: 'Select airlines to exclude',
                allowClear: true
            });

        } else {
            advancedSettings.style.display = 'none';
            toggleButton.classList.remove('expanded'); // Remove the 'expanded' class
        }
    });
    
    // Tool tip function
    $j('#helpBtn').on('click', function(event) {
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
    $j(document).on('click', function(e) {
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
        altFormat: "j M Y",
        dateFormat: "j M Y",
        minDate: "today",
        locale: {
            firstDayOfWeek: 1 // Set Monday as the first day of the week
        },
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

    $j('#oneWayTrip').change(function() {
        if ($j(this).is(':checked')) {
            console.log("One-way trip selected");
            // Hide the inbound slider
            $j('#inbound-timeRangeSlider').hide();
            $j('#inbound-timeRangeDisplay').hide();
            // Change the text for the outbound time display to "Departure time" but keep the current time display
            $j('#outbound-timeRangeDisplay').html('Departure time: <span id="outboundTimeStartDisplay"></span> - <span id="outboundTimeEndDisplay"></span>');
            // Update the time display spans with the current values
            var outboundStart = outboundSlider.noUiSlider.get()[0];
            var outboundEnd = outboundSlider.noUiSlider.get()[1];
            $j('#outboundTimeStartDisplay').text(outboundStart);
            $j('#outboundTimeEndDisplay').text(outboundEnd);
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
            $j('#inbound-timeRangeSlider').show();
            $j('#inbound-timeRangeDisplay').show();
            $j('#outbound-timeRangeDisplay').html('Outbound departure time: <span id="outboundTimeStartDisplay"></span> - <span id="outboundTimeEndDisplay"></span>');
            // Update the time display spans with the current values to ensure they remain accurate
            var outboundStart = outboundSlider.noUiSlider.get()[0];
            var outboundEnd = outboundSlider.noUiSlider.get()[1];
            $j('#outboundTimeStartDisplay').text(outboundStart);
            $j('#outboundTimeEndDisplay').text(outboundEnd);
            // Change Flatpickr back to range selection mode
            flatpickrInstance.set('mode', 'range');
        }
    });

    // Listener for Flexible dates switch changes
    $j('#flexibleDates').change(function() {
        if ($j(this).is(':checked')) {
            console.log("Flexible dates selected");
        } else {
            console.log("Exact dates selected");
        }
    });

    // When the value of origin (iataCodeFrom) changes
    $j('#iataCodeFrom').on('input', function() {
        // Clear selections in the "Exclude Airlines" dropdown
        $j('#excludeAirlines').val(null).trigger('change');
        $j('#excludeAirlines').select2({
            placeholder: 'Select airlines to exclude',
            allowClear: true
        });

        // Optionally: Remove all options from the dropdown if you want to start fresh
        $j('#excludeAirlines').empty().trigger('change');
        $j('#excludeAirlines').select2({
            placeholder: 'Select airlines to exclude',
            allowClear: true
        });

        // Note: You can reinitialize or update the dropdown with any default options here if needed
    });

    // When the value of destination (iataCodeTo) changes
    $j('#iataCodeTo').on('input', function() {
        // Clear selections in the "Exclude Airlines" dropdown
        $j('#excludeAirlines').val(null).trigger('change');

        // Optionally: Remove all options from the dropdown if you want to start fresh
        $j('#excludeAirlines').empty().trigger('change');

        // Note: You can reinitialize or update the dropdown with any default options here if needed
    });

    $j('#suggestPriceBtn').on('click', function() {
        // Check if the travel dates are selected
        var travelDatesSelected = selectedStartDate && (selectedEndDate || $j('#oneWayTrip').is(':checked'));
        if (!travelDatesSelected) {
            alert('Please select your travel dates.');
            flatpickrInstance.open(); // Open Flatpickr calendar
            return;
        }

        // Check if the maximum number of stops is filled
        var maxStops = $j('#maxStops').val();
        if (maxStops === '') {
            alert('Please fill in the maximum number of layovers. For direct flights, use 0.');
            $j('#maxStops').focus();
            return;
        }

        // Check if the number of passengers is filled
        var nbrPassengers = $j('#nbrPassengers').val();
        if (nbrPassengers === '') {
            alert('Please fill in the number of passengers.');
            $j('#nbrPassengers').focus();
            return;
        }

        // Check if the duration field is filled, only if direct flights only is not enabled
        if (!$j('#directFlight').is(':checked')) {
            var maxTravelDuration = $j('#maxFlightDuration').val();
            if (maxTravelDuration === '') {
                alert('Please fill in Travel duration (max).');
                $j('#maxFlightDuration').focus();
                return;
            }
        }

        adjustDatesForFlexibility(); // Adjust dates and get them formatted
        suggestPriceLimit(); // Run the suggest price limit function
    });

    // Direct-flight only button toggle function
    $j('#directFlight').change(function() {
        if ($j(this).is(':checked')) {
            console.log("Direct flights only enabled");
            $j('#maxStops').prop('disabled', true).val('0').addClass('disabled-input');
            $j('#maxFlightDuration').prop('disabled', true).val('').addClass('disabled-input');
            console.log("Max stops input disabled, set to 0, and styled as disabled");
        } else {
            console.log("Direct flights only disabled");
            $j('#maxStops').prop('disabled', false).val('').removeClass('disabled-input'); // Clear value when direct flights is unchecked
            $j('#maxFlightDuration').prop('disabled', false).val('').removeClass('disabled-input');
            console.log("Max stops input enabled, cleared, and styled as normal");
        }
    });

    async function suggestPriceLimit() {
        console.log("Sending Current Price request");
        $j('.loader').show(); // Show the loading icon
    
        let airlineModeSwitchState = $j('#airlineModeSwitch').is(':checked');
    
        const requestData = {
            origin: extractIATACode('iataCodeFrom'),
            destination: extractIATACode('iataCodeTo'),
            dateFrom: depDate_From,
            dateTo: depDate_To,
            returnFrom: returnDate_From,
            returnTo: returnDate_To,
            maxStops: parseInt($j('#maxStops').val()),
            maxFlyDuration: parseFloat($j('#maxFlightDuration').val()),
            flightType: $j('#oneWayTrip').is(':checked') ? 'one-way' : 'return',
            currency: $j('#currency').val(),
            dtime_from: outboundSlider.noUiSlider.get()[0],
            dtime_to: outboundSlider.noUiSlider.get()[1],
            ret_dtime_from: $j('#oneWayTrip').is(':checked') ? '' : inboundSlider.noUiSlider.get()[0],
            ret_dtime_to: $j('#oneWayTrip').is(':checked') ? '' : inboundSlider.noUiSlider.get()[1],
            select_airlines: $j('#excludeAirlines').val().join(','),
            select_airlines_exclude: !airlineModeSwitchState
        };
    
        console.log(requestData);
    
        try {
            const response = await fetch('/api/suggestPriceLimit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
    
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
    
            const tequilaResponse = await response.json();
            console.log('Raw response from Tequila API:', tequilaResponse);
    
            globalTequilaResponse = tequilaResponse;
    
            if (tequilaResponse.data && tequilaResponse.data.length > 0) {
                const lowestPriceFlight = tequilaResponse.data[0];
                const roundedPrice = Math.ceil(lowestPriceFlight.price);
                $j('#maxPricePerPerson').val(roundedPrice);
    
                const uniqueAirlines = [...new Set(tequilaResponse.data.flatMap(flight => flight.airlines))];
                updateExcludedAirlinesDropdown(uniqueAirlines);
    
                $j('#submitFormButton').prop('disabled', false);
                $j('#advancedSettingsToggle').show();
            } else {
                alert("No flights available for the given parameters. Please adjust your search criteria.");
            }
    
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('There was an error processing your request. Please try again later.');
        } finally {
            $j('.loader').hide();
        }
    }
    

    // This revised version uses the airlinesDict to display names but stores codes as values.
    async function updateExcludedAirlinesDropdown(airlines) {
        // Clear the current options in the dropdown
        $j('#excludeAirlines').empty();

        // Add new options from the response, mapping codes to names for display
        airlines.forEach(code => {
            const airlineName = airlinesDict[code] || code; // Use the airline name if available, otherwise the code
            $j('#excludeAirlines').append(new Option(airlineName, code)); // Here code is the value
        });
        
        // Reinitialize the Select2 component to update its options
        $j('#excludeAirlines').select2({
            placeholder: 'Select airlines to exclude',
            allowClear: true
        });
    }

    // Track the mode based on the switch's position
    let airlineSelectionMode = false; // False for exclude mode, true for include mode

    // Initialize airlines dropdown as "Exclude Airlines"
    $j('#excludeAirlines').select2({
        placeholder: 'Select airlines to exclude',
        allowClear: true
    });

    // Assuming airlineSelectionMode is tracked by the switch's checked state
    $j('#airlineModeSwitch').change(function() {
        airlineSelectionMode = this.checked;
        
        // Update the placeholder text based on the switch's state
        var newPlaceholder = airlineSelectionMode ? 'Select airlines to include' : 'Select airlines to exclude';
        $j('#excludeAirlines').select2('destroy').select2({
            placeholder: newPlaceholder,
            allowClear: true
        });

        if (airlineSelectionMode) {
            // Select all airlines when in include mode
            var allAirlineIds = $j('#excludeAirlines option').map(function() { return this.value }).get();
            $j('#excludeAirlines').val(allAirlineIds).trigger('change');
        } else {
            // Clear the selection when switching back to exclude mode
            $j('#excludeAirlines').val(null).trigger('change');
        }

        // Call updatePriceBasedOnSelection to adjust the price field according to the new mode and selected airlines
        updatePriceBasedOnSelection();
    });

    // Add an event listener to the "excludeAirlines" dropdown
    $j('#excludeAirlines').on('change', function() {
        updatePriceBasedOnSelection();
    });

    function updatePriceBasedOnSelection() {
        const selectedAirlines = $j('#excludeAirlines').val();
        
        if (!globalTequilaResponse || !globalTequilaResponse.data) {
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
            $j('#maxPricePerPerson').val(roundedPrice);
        } else {
            $j('#maxPricePerPerson').val(''); // Clear the price field
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

        if ($j('#flexibleDates').is(':checked')) {
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
    
    function askForHotelTracking() {
        console.log('modal is shown.');
        $j('#hotelTrackingModal').modal('show');
    }
    

    async function fetchCityFromIATACode(redirectIataCodeTo) {
        const backendUrl = `/api/getCityByIATA?iataCode=${encodeURIComponent(redirectIataCodeTo)}`;
    
        try {
            const response = await fetch(backendUrl);
            const data = await response.json();
            console.log(data);
    
            return data.city || '';
        } catch (error) {
            console.error('Error fetching city from IATA code:', error);
        }
        return '';
    }
    



    // Event listener for the confirm button in the modal
    $j('#confirmHotelTracker').on('click', async function() {     
        // Redirect to hotel tracker form with parameters
        console.log(redirectUrl);
        top.location.href = redirectUrl;
    });

    
    // Optionally handle the modal dismissal
    $j('.modal-footer .btn-secondary').on('click', function() {
        console.log('No is selected, clearing the form.');
    });
    
    

    function populateDatalist(datalistId, data) {
        const datalist = document.getElementById(datalistId);
        datalist.innerHTML = '';
        Object.keys(data).forEach(key => {
            const option = document.createElement('option');
            option.value = `${key} - ${data[key]}`;
            datalist.appendChild(option);
        });
    }
    

    document.getElementById('sheetyForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        adjustDatesForFlexibility(); // Adjust dates and get them formatted
        $j('.loader').show(); // Show the loader

        // Generate a unique token for each submission
        function generateToken() {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            } else {
                return new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
            }
        }

        // Check the state of the switch to determine the mode for airlines inclusion or exclusion
        let airlineModeSwitchState = $j('#airlineModeSwitch').is(':checked');
        let selectedAirlines = $j('#excludeAirlines').val();

        if (airlineModeSwitchState && (!selectedAirlines || selectedAirlines.length === 0)) {
            alert('Please include at least one airline in your search.');
            $j('#excludeAirlines').select2('open'); // Focus on the airline selection
            $j('.loader').hide(); // Hide the loader if validation fails
            return; // Exit the function to prevent submission
        }

        // Extract the times from the noUiSlider
        const outboundTimes = outboundSlider.noUiSlider.get();
        let inboundTimes = ['', '']; // Default to empty strings
        // Only get inbound times if it's not a one-way trip
        if (!$j('#oneWayTrip').is(':checked')) {
            inboundTimes = inboundSlider.noUiSlider.get();
        }

        let formData = {
            price: {
                iataCodeFrom: extractIATACode('iataCodeFrom'),
                iataCodeTo: extractIATACode('iataCodeTo'),
                flightType: $j('#oneWayTrip').is(':checked') ? 'one-way' : 'return',
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
                excludedAirlines: $j('#excludeAirlines').val() ? $j('#excludeAirlines').val().join(',') : '',
                exclude: !airlineModeSwitchState, // Set based on the switch state
                email: document.getElementById('email').value,
                token: generateToken(),
                lastFetchedPrice: 0,
                lowestFetchedPrice: 'null'
            }
        };

        console.log('Sending data to SheetyProxy:', formData);

        try {
            const response = await fetch('/api/sheetyProxy', {
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

            // Capture IATA code, email, and currency
            redirectEmail = encodeURIComponent($j('#email').val());
            redirectCurrency = encodeURIComponent($j('#currency').val());
            redirectIataCodeTo = $j('#iataCodeTo').val().split(' - ')[0];
            console.log(redirectIataCodeTo);



            // Fetch city name and redirect to hotel tracker URL
            redirectCity = encodeURIComponent(await fetchCityFromIATACode(redirectIataCodeTo));
            redirectUrl = `https://www.robotize.no/hotels?email=${redirectEmail}&currency=${redirectCurrency}&city=${redirectCity}&dateFrom=${depDate_From}&dateTo=${returnDate_From}`;

            // Ask for Hotel tracker
            askForHotelTracking();


                // Attempt to send email via backend API after the user alert
                try {
                    const emailResponse = await fetch('/api/sendMail', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            subject: "New submission for your Flight Robot",
                            body: `Great news, somebody just signed up for your Flight Robot! Here are the details:<br><br>
                                From: ${extractIATACode('iataCodeFrom')}<br>
                                To: ${extractIATACode('iataCodeTo')}<br>
                                Date: ${depDate_From}<br>
                                Passengers: ${parseInputValue(parseInt(document.getElementById('nbrPassengers').value))}<br>
                                Email: ${document.getElementById('email').value}<br><br>
                                Thank you!`,
                            recipient_email: document.getElementById('email').value  // Using recipient email directly from form input
                        })
                    });

                    if (!emailResponse.ok) {
                        throw new Error('Failed to send email.');
                    }
                } catch (emailError) {
                    console.error('Error during email sending:', emailError.message);
                }

        } catch (error) {
            console.error('Error:', error);
            alert('There was an error processing your request. Please try again later.');
        } finally {
            $j('.loader').hide(); // Hide the loader
            // Clear form fields
            // After successful submission, explicitly clear the price field and any related global variables
            globalTequilaResponse = null; // Reset global variable holding the response
            $j('#maxPricePerPerson').val(''); // Clear the price field
            document.getElementById('sheetyForm').reset();
        }

        // Reset default values for "From" field based on location
        fetchClosestAirport(city);

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
