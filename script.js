// Use jQuery in noConflict mode to avoid conflicts
const $ = jQuery.noConflict();

$(document).ready(function () {
    console.log("Flight Site Loaded");

    // ===========================
    // Constants and Selectors
    // ===========================
    const SELECTORS = {
        iataCodeFrom: $('#iataCodeFrom'),
        iataCodeTo: $('#iataCodeTo'),
        currencyInput: $('#currency'),
        emailInput: $('#email'),
        searchForm: $('#sheetyForm'),
        loader: $('.loader'),
        maxStopsInput: $('#maxStops'),
        nbrPassengersInput: $('#nbrPassengers'),
        maxFlightDurationInput: $('#maxFlightDuration'),
        oneWayTripCheckbox: $('#oneWayTrip'),
        directFlightCheckbox: $('#directFlight'),
        flexibleDatesCheckbox: $('#flexibleDates'),
        excludeAirlinesSelect: $('#excludeAirlines'),
        airlineModeSwitch: $('#airlineModeSwitch'),
        advancedSettingsToggle: $('#advancedSettingsToggle'),
        advancedSettings: $('#advancedSettings'),
        suggestPriceBtn: $('#suggestPriceBtn'),
        outboundSlider: $('#outbound-timeRangeSlider')[0],
        inboundSlider: $('#inbound-timeRangeSlider')[0],
        submitFormButton: $('#submitFormButton'),
        helpBtn: $('#helpBtn'),
        tooltip: $('#tooltip'),
        confirmHotelTrackerBtn: $('#confirmHotelTracker'),
        cancelHotelTrackerBtn: $('#cancelHotelTracker'),
        hotelTrackingModal: $('#hotelTrackingModal'),
        dateField: $('#dateField'),
        outboundTimeStartDisplay: $('#outboundTimeStartDisplay'),
        outboundTimeEndDisplay: $('#outboundTimeEndDisplay'),
        inboundTimeStartDisplay: $('#inboundTimeStartDisplay'),
        inboundTimeEndDisplay: $('#inboundTimeEndDisplay'),
        maxPricePerPerson: $('#maxPricePerPerson'),
        iataCodeFromList: $('#iataCodeFromList'),
        iataCodeToList: $('#iataCodeToList'),
    };

    const API_ENDPOINTS = {
        ipGeo: 'https://api.ipgeolocation.io/ipgeo?apiKey=420e90eecc6c4bb285f238f38aea898f',
        getClosestAirport: '/api/getClosestAirport',
        suggestPriceLimit: '/api/suggestPriceLimit',
        getCityByIATA: '/api/getCityByIATA',
        sheetyProxy: '/api/sheetyProxy',
        sendMail: '/api/sendEmail',
        readAirportsData: 'airports.txt',
        readAirlinesData: 'airline_data.txt',
    };

    // ===========================
    // Global Variables
    // ===========================
    let airportData = {};
    let airlinesDict = {};
    let selectedStartDate = '';
    let selectedEndDate = '';
    let depDate_From = '';
    let depDate_To = '';
    let returnDate_From = '';
    let returnDate_To = '';
    let globalTequilaResponse = null;
    let city = '';
    let redirectEmail = '';
    let redirectIataCodeTo = '';
    let redirectCurrency = '';
    let redirectCity = '';
    let redirectUrl = '';
    let airlineSelectionMode = false; // False for exclude mode, true for include mode
    let flatpickrInstance = null; // To store the Flatpickr instance

    // ===========================
    // Helper Functions
    // ===========================

    /**
     * Extract the IATA code from an input field.
     * @param {string} inputId 
     * @returns {string} IATA code, possibly prefixed with 'city:'.
     */
    const extractIATACode = (inputId) => {
        const inputValue = document.getElementById(inputId).value;
        if (!inputValue) {
            console.error('Input value not found');
            return '';
        }
        const iataCode = inputValue.split(' - ')[0].trim();
        const containsAllAirports = inputValue.toLowerCase().includes("all airports");

        return containsAllAirports ? `city:${iataCode}` : iataCode;
    };

    /**
     * Safely parse input values, handling NaN cases.
     * @param {number} value 
     * @returns {number|string} Parsed value or empty string.
     */
    const parseInputValue = (value) => {
        if (typeof value === 'string' && value === "NaN/NaN/NaN") {
            return "";
        }
        if (isNaN(value)) {
            return "";
        }
        return value;
    };

    /**
     * Generate a unique token for each submission.
     * @returns {string} Unique token.
     */
    const generateToken = () => {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        } else {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }
    };

    /**
     * Format a Date object to DD/MM/YYYY.
     * @param {Date} dateObject 
     * @returns {string} Formatted date string.
     */
    const formatDate = (dateObject) => {
        if (!dateObject || !(dateObject instanceof Date) || isNaN(dateObject.getTime())) {
            console.error('Invalid date:', dateObject);
            return "";
        }
        const day = dateObject.getDate().toString().padStart(2, '0');
        const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObject.getFullYear();
        return `${day}/${month}/${year}`;
    };

    /**
     * Get query parameters from the URL.
     * @returns {Object} Query parameters as key-value pairs.
     */
    const getQueryParams = () => {
        const params = new URLSearchParams(window.location.search);
        const queryParams = {};
        for (const [key, value] of params.entries()) {
            queryParams[key] = value;
        }
        return queryParams;
    };

    /**
     * Populate a datalist with airport data.
     * @param {string} datalistId 
     * @param {Object} data 
     */
    const populateDatalist = (datalistId, data) => {
        const datalist = document.getElementById(datalistId);
        if (!datalist) return; // Prevent errors if datalist does not exist
        datalist.innerHTML = '';
        Object.keys(data).forEach(key => {
            const option = document.createElement('option');
            option.value = `${key} - ${data[key]}`;
            datalist.appendChild(option);
        });
    };

    /**
     * Initialize Select2 for the airlines dropdown.
     * @param {string} placeholder 
     */
    const initializeSelect2 = (placeholder) => {
        SELECTORS.excludeAirlinesSelect.select2({
            placeholder: placeholder,
            allowClear: true
        });
    };

    // ===========================
    // Initialization Functions
    // ===========================

    /**
     * Initialize the Flatpickr date range picker.
     */
    const initializeDatePicker = () => {
        flatpickrInstance = flatpickr("#dateField", {
            altInput: true,
            mode: "range",
            altFormat: "j M Y",
            dateFormat: "j M Y",
            minDate: "today",
            locale: {
                firstDayOfWeek: 1 // Monday
            },
            onChange: handleDateChange
        });
    };

    /**
     * Handle changes in the date picker.
     * @param {Array} selectedDates 
     * @param {string} dateStr 
     * @param {Object} instance 
     */
    function handleDateChange(selectedDates, dateStr, instance) {
        console.log(selectedDates, dateStr);
        // Update the selected start and end dates
        selectedStartDate = selectedDates[0];
        depDate_From = formatDate(selectedStartDate);
        depDate_To = formatDate(selectedStartDate);

        selectedEndDate = selectedDates.length === 2 ? selectedDates[1] : '';
        returnDate_From = formatDate(selectedEndDate);
        returnDate_To = formatDate(selectedEndDate);
    }

    /**
     * Initialize a noUiSlider.
     * @param {HTMLElement} sliderElement 
     * @param {Function} updateCallback 
     */
    const initializeSlider = (sliderElement, updateCallback) => {
        noUiSlider.create(sliderElement, {
            start: [0, 24],
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

        sliderElement.noUiSlider.on('update', updateCallback);
    };

    /**
     * Initialize the noUiSliders for outbound and inbound times.
     */
    const initializeSliders = () => {
        // Outbound Time Range Slider
        initializeSlider(SELECTORS.outboundSlider, function (values, handle) {
            SELECTORS.outboundTimeStartDisplay.text(values[0]);
            SELECTORS.outboundTimeEndDisplay.text(values[1]);
        });

        // Inbound Time Range Slider
        initializeSlider(SELECTORS.inboundSlider, function (values, handle) {
            SELECTORS.inboundTimeStartDisplay.text(values[0]);
            SELECTORS.inboundTimeEndDisplay.text(values[1]);
        });
    };

    /**
     * Initialize the autocomplete functionality for IATA code fields.
     */
    const initializeAutocomplete = () => {
        $(".autocomplete-iata").autocomplete({
            source: function (request, response) {
                const results = $.map(airportData, function (value, key) {
                    if (key.toLowerCase().startsWith(request.term.toLowerCase()) || value.toLowerCase().includes(request.term.toLowerCase())) {
                        return { label: `${key} - ${value}`, value: `${key} - ${value}` };
                    }
                });
                response(results.slice(0, 10)); // Limit to top 10 matches
            },
            minLength: 2
        });
    };

    /**
     * Adjust dates based on the flexible dates toggle.
     */
    const adjustDatesForFlexibility = () => {
        let adjustedDepFromDate = new Date(selectedStartDate);
        let adjustedDepToDate = new Date(selectedStartDate);
        let adjustedReturnFromDate = selectedEndDate ? new Date(selectedEndDate) : null;
        let adjustedReturnToDate = selectedEndDate ? new Date(selectedEndDate) : null;

        if (SELECTORS.flexibleDatesCheckbox.is(':checked')) {
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
    };

    // ===========================
    // Backend Interaction Functions
    // ===========================

    /**
     * Load data from a specified endpoint.
     * @param {string} endpoint 
     * @param {string} type - 'text' or 'json'
     * @returns {Object} Parsed data
     */
    const loadData = async (endpoint, type = 'json') => {
        try {
            const response = await fetch(API_ENDPOINTS[endpoint]);
            if (!response.ok) throw new Error(`Failed to load ${endpoint}: ${response.statusText}`);

            if (type === 'text') {
                const text = await response.text();
                const data = {};
                text.split('\n').forEach(line => {
                    const [code, name] = line.split(' - ');
                    if (code && name) {
                        data[code.trim()] = name.trim();
                    }
                });
                return data;
            } else if (type === 'json') {
                const data = await response.json();
                const dict = {};
                data.forEach(item => {
                    dict[item.code] = item.name;
                });
                return dict;
            }
        } catch (error) {
            console.error(`Error loading ${endpoint}:`, error);
            return {};
        }
    };

    /**
     * Update currency and location based on the user's IP address.
     */
    const updateCurrencyAndLocation = async () => {
        try {
            const response = await fetch(API_ENDPOINTS.ipGeo);
            if (!response.ok) {
                throw new Error(`Failed to fetch IP Geolocation data: ${response.statusText}`);
            }
            const data = await response.json();
            
            // Update the currency input if currency data is available
            if (data.currency && data.currency.code) {
                SELECTORS.currencyInput.val(data.currency.code);
            }
            
            // Update location fields based on geolocation data
            if (data.latitude && data.longitude) {
                await fetchClosestAirport(data.latitude, data.longitude);
            }
            
            // Optionally, update other location-related fields here
        } catch (error) {
            console.error('Error updating currency and location:', error);
            // Optionally, handle the error by setting default values or notifying the user
        }
    };

    /**
     * Fetch the closest airport based on latitude and longitude via the backend API using Tequila.
     * @param {number} latitude 
     * @param {number} longitude 
     */
    const fetchClosestAirport = async (latitude, longitude) => {
        console.log('Searching closest airport to coordinates:', latitude, longitude);

        try {
            const response = await fetch(API_ENDPOINTS.getClosestAirport, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude })
            });

            if (!response.ok) {
                // Attempt to parse error message from backend
                const errorData = await response.json();
                const errorMessage = errorData.error || `Failed to fetch airport data: ${response.status} - ${response.statusText}`;
                throw new Error(errorMessage);
            }

            const tequilaData = await response.json();
            console.log('Tequila API Response:', tequilaData);
            
            // Check if required fields are present
            if (tequilaData.code) {
                const airportIATA = tequilaData.code;
                const airportName = airportData[airportIATA] || 'Unknown Airport';
                const cityName = tequilaData.city || 'Unknown City';
                const countryName = tequilaData.country || 'Unknown Country';

                console.log(`Closest Airport: ${airportIATA} - ${airportName}, ${cityName}, ${countryName}`);

                // Update the IATA Code From field in the UI
                SELECTORS.iataCodeFrom.val(`${airportIATA} - ${airportName}`).trigger('change');
            } else {
                console.log('No airport data found in the response.');
                alert('No nearby airports found based on your location. Please select your departure airport manually.');
            }
        } catch (error) {
            console.error('Error fetching closest airport:', error);
            alert('There was an error determining your closest airport. Please select your departure airport manually.');
        }
    };



    /**
     * Populate the airlines dropdown with options.
     * @param {Array} airlines 
     */
    const updateExcludedAirlinesDropdown = (airlines) => {
        // Clear existing options
        SELECTORS.excludeAirlinesSelect.empty();

        // Populate with new airline options
        airlines.forEach(code => {
            const airlineName = airlinesDict[code] || code;
            SELECTORS.excludeAirlinesSelect.append(new Option(airlineName, code));
        });

        // Reinitialize Select2 to update options
        initializeSelect2(airlineSelectionMode ? 'Select airlines to include' : 'Select airlines to exclude');
    };


    /**
     * Suggest price limit by querying the backend API.
     */
    const suggestPriceLimit = async () => {
        console.log("Sending Current Price request");
        SELECTORS.loader.show(); // Show the loading icon

        const airlineModeSwitchState = SELECTORS.airlineModeSwitch.is(':checked');

        const params = new URLSearchParams({
            origin: extractIATACode('iataCodeFrom'),
            destination: extractIATACode('iataCodeTo'),
            dateFrom: depDate_From,
            dateTo: depDate_To,
            returnFrom: returnDate_From,
            returnTo: returnDate_To,
            maxStops: parseInt(SELECTORS.maxStopsInput.val()),
            maxFlyDuration: parseFloat(SELECTORS.maxFlightDurationInput.val()) || '',
            flightType: SELECTORS.oneWayTripCheckbox.is(':checked') ? 'oneway' : 'return',
            currency: SELECTORS.currencyInput.val(),
            dtime_from: SELECTORS.outboundTimeStartDisplay.text(),
            dtime_to: SELECTORS.outboundTimeEndDisplay.text(),
            ret_dtime_from: SELECTORS.oneWayTripCheckbox.is(':checked') ? '' : SELECTORS.inboundTimeStartDisplay.text(),
            ret_dtime_to: SELECTORS.oneWayTripCheckbox.is(':checked') ? '' : SELECTORS.inboundTimeEndDisplay.text(),
            select_airlines: SELECTORS.excludeAirlinesSelect.val() ? SELECTORS.excludeAirlinesSelect.val().join(',') : '',
            select_airlines_exclude: !airlineModeSwitchState
        });

        try {
            const response = await fetch(`/api/suggestPriceLimit?${params.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const tequilaResponse = await response.json();
            console.log('Raw response from Tequila API:', tequilaResponse);
            handleTequilaResponse(tequilaResponse);

            // Show the Advanced Settings toggle after successful request
            SELECTORS.advancedSettingsToggle.show();

        } catch (error) {
            console.error('Error fetching data:', error);
            alert('There was an error processing your request. Please try again later.');
        } finally {
            SELECTORS.loader.hide();
        }
    };

    /**
     * Handle the response from the Tequila API and update the UI accordingly.
     * @param {Object} tequilaResponse 
     */
    const handleTequilaResponse = (tequilaResponse) => {
        globalTequilaResponse = tequilaResponse;

        if (tequilaResponse.data && tequilaResponse.data.length > 0) {
            const lowestPriceFlight = tequilaResponse.data[0];
            const roundedPrice = Math.ceil(lowestPriceFlight.price);
            SELECTORS.maxPricePerPerson.val(roundedPrice);

            const uniqueAirlines = [...new Set(tequilaResponse.data.flatMap(flight => flight.airlines))];
            updateExcludedAirlinesDropdown(uniqueAirlines);

            // Enable the Submit button since a matching flight was found
            SELECTORS.submitFormButton.prop('disabled', false);
        } else {
            alert("No flights available for the given parameters. Please adjust your search criteria.");
        }
    };

    /**
     * Submit form data to SheetyProxy API.
     * @param {Object} formData 
     * @returns {Object} Sheety response data.
     */
    const submitToSheetyProxy = async (formData) => {
        try {
            const response = await fetch(API_ENDPOINTS.sheetyProxy, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            return await response.json();
        } catch (error) {
            console.error('Error submitting to SheetyProxy:', error);
            throw error;
        }
    };

    /**
     * Capture redirect parameters after form submission.
     */
    const captureRedirectParameters = () => {
        redirectEmail = encodeURIComponent(SELECTORS.emailInput.val());
        redirectCurrency = encodeURIComponent(SELECTORS.currencyInput.val());
        const iataCodeToValue = SELECTORS.iataCodeTo.val();
        redirectIataCodeTo = iataCodeToValue ? iataCodeToValue.split(' - ')[0] : '';
        console.log('Redirect IATA Code To:', redirectIataCodeTo);
    };

    /**
     * Fetch city name from IATA code via backend API.
     * @param {string} iataCode 
     * @returns {string} City name.
     */
    const fetchCityFromIATACode = async (iataCode) => {
        const backendUrl = `${API_ENDPOINTS.getCityByIATA}?iataCode=${encodeURIComponent(iataCode)}`;

        try {
            const response = await fetch(backendUrl);
            const data = await response.json();
            console.log('City fetched:', data);
            return data.city || '';
        } catch (error) {
            console.error('Error fetching city from IATA code:', error);
            return '';
        }
    };

    /**
     * Send an email notification via the backend API.
     * @param {Object} formData 
     */
    const sendEmailNotification = async (formData) => {
        try {
            const emailResponse = await fetch(API_ENDPOINTS.sendMail, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subject: "New submission for your Flight Robot",
                    body: `
                        Great news, somebody just signed up for your Flight Robot! Here are the details:<br><br>
                        From: ${extractIATACode('iataCodeFrom')}<br>
                        To: ${extractIATACode('iataCodeTo')}<br>
                        Date: ${depDate_From}<br>
                        Passengers: ${parseInputValue(parseInt(SELECTORS.nbrPassengersInput.val()))}<br>
                        Email: ${SELECTORS.emailInput.val()}<br><br>
                        Thank you!
                    `,
                    recipient_email: SELECTORS.emailInput.val()
                })
            });

            if (!emailResponse.ok) {
                throw new Error('Failed to send email.');
            }

            console.log('Email sent successfully');

        } catch (error) {
            console.error('Error during email sending:', error.message);
        }
    };

    /**
     * Ask the user if they want to track hotel prices via a modal.
     */
    const askForHotelTracking = () => {
        console.log('Showing hotel tracking modal.');
        SELECTORS.hotelTrackingModal.modal('show');
    };

    // ===========================
    // Event Handler Functions
    // ===========================

    /**
     * Handle form submission to suggest price limits.
     * @param {Event} event 
     */
    const handleFormSubmission = async (event) => {
        event.preventDefault();
        adjustDatesForFlexibility();
        SELECTORS.loader.show();

        const formData = buildFormData();
        console.log('Sending data to SheetyProxy:', formData);

        try {
            const sheetyResponse = await submitToSheetyProxy(formData);
            console.log('SheetyProxy response:', sheetyResponse);

            // Capture redirect parameters
            captureRedirectParameters();

            // Fetch city from IATA code
            redirectCity = encodeURIComponent(await fetchCityFromIATACode(redirectIataCodeTo));
            redirectUrl = `https://www.robotize.no/hotels?email=${redirectEmail}&currency=${redirectCurrency}&city=${redirectCity}&dateFrom=${depDate_From}&dateTo=${returnDate_From}`;

            // Send email notification
            await sendEmailNotification(formData);
            
            // Show hotel tracking modal
            askForHotelTracking();


        } catch (error) {
            console.error('Error during form submission:', error);
            alert('There was an error processing your request. Please try again later.');
        } finally {
            SELECTORS.loader.hide();
        }
    };

    /**
     * Handle changes in the one-way trip checkbox.
     */
    const handleOneWayTripChange = () => {
        if (SELECTORS.oneWayTripCheckbox.is(':checked')) {
            console.log("One-way trip selected");
            // Hide inbound slider and adjust display
            $('#inbound-timeRangeSlider, #inbound-timeRangeDisplay').hide();
            $('#outbound-timeRangeDisplay').html('Departure time: <span id="outboundTimeStartDisplay"></span> - <span id="outboundTimeEndDisplay"></span>');
            // Set Flatpickr to single date mode
            flatpickrInstance.set('mode', 'single');
            selectedEndDate = null;
            returnDate_From = '';
            returnDate_To = '';
            flatpickrInstance.clear();
            if (selectedStartDate) {
                flatpickrInstance.setDate(selectedStartDate, true);
            }
        } else {
            console.log("Return trip selected");
            // Show inbound slider and revert display
            $('#inbound-timeRangeSlider, #inbound-timeRangeDisplay').show();
            $('#outbound-timeRangeDisplay').html('Outbound departure time: <span id="outboundTimeStartDisplay"></span> - <span id="outboundTimeEndDisplay"></span>');
            flatpickrInstance.set('mode', 'range');
        }
    };

    /**
     * Handle changes in the direct flight checkbox.
     */
    const handleDirectFlightChange = () => {
        if (SELECTORS.directFlightCheckbox.is(':checked')) {
            console.log("Direct flights only enabled");
            SELECTORS.maxStopsInput.val('0').prop('disabled', true).addClass('disabled-input');
            SELECTORS.maxFlightDurationInput.val('').prop('disabled', true).addClass('disabled-input');
        } else {
            console.log("Direct flights only disabled");
            SELECTORS.maxStopsInput.prop('disabled', false).removeClass('disabled-input').val('');
            SELECTORS.maxFlightDurationInput.prop('disabled', false).removeClass('disabled-input').val('');
        }
    };

    /**
     * Handle changes in the flexible dates checkbox.
     */
    const handleFlexibleDatesChange = () => {
        console.log('Flexible dates toggle changed.');
        // Additional logic can be added here if needed
    };

    /**
     * Handle changes in the airline mode switch.
     */
    const handleAirlineModeSwitchChange = () => {
        airlineSelectionMode = SELECTORS.airlineModeSwitch.is(':checked');
        const newPlaceholder = airlineSelectionMode ? 'Select airlines to include' : 'Select airlines to exclude';
        initializeSelect2(newPlaceholder);

        if (airlineSelectionMode) {
            // Include mode: select all airlines
            const allAirlineIds = SELECTORS.excludeAirlinesSelect.find('option').map(function () { return this.value }).get();
            SELECTORS.excludeAirlinesSelect.val(allAirlineIds).trigger('change');
        } else {
            // Exclude mode: clear selection
            SELECTORS.excludeAirlinesSelect.val(null).trigger('change');
        }

        updatePriceBasedOnSelection();
    };


    /**
     * Handle changes in the "Exclude Airlines" dropdown.
     */
    const handleExcludedAirlinesChange = () => {
        updatePriceBasedOnSelection();
    };

    /**
     * Handle the confirmation to track hotels.
     */
    const handleConfirmHotelTracker = () => {
        console.log('User confirmed hotel tracking.');
        window.location.href = redirectUrl;
    };


    /**
     * Handle the "No" button click to reload the page.
     */
    const handleCancelHotelTracker = () => {
        console.log('User declined hotel tracking. Reloading the page.');
        window.location.reload(true); // Forces reload from the server
    };


    /**
     * Handle the switch icon click to toggle IATA codes.
     */
    const switchIATACodes = () => {
        const fromVal = SELECTORS.iataCodeFrom.val();
        const toVal = SELECTORS.iataCodeTo.val();
        SELECTORS.iataCodeFrom.val(toVal).trigger('change');
        SELECTORS.iataCodeTo.val(fromVal).trigger('change');
    };

    /**
     * Toggle the tooltip display.
     * @param {Event} event 
     */
    const toggleTooltip = (event) => {
        const tooltip = SELECTORS.tooltip;
        console.log("Tooltip button clicked.");
        tooltip.toggle();
        event.stopPropagation();
    };

    /**
     * Update the suggested price based on airline selections.
     */
    const updatePriceBasedOnSelection = () => {
        const selectedAirlines = SELECTORS.excludeAirlinesSelect.val();
        console.log('Selected Airlines: ',selectedAirlines);

        if (!globalTequilaResponse || !globalTequilaResponse.data) {
            return;
        }

        let filteredFlights;
        if (airlineSelectionMode) {
            // Include mode: keep flights operated exclusively by the selected airlines
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
            const roundedPrice = Math.ceil(lowestPrice);
            SELECTORS.maxPricePerPerson.val(roundedPrice);
            console.log('Updated the price to:',roundedPrice);
        } else {
            SELECTORS.maxPricePerPerson.val('');
            console.log('Updated the price to nothing');

        }
    };

    // ===========================
    // Event Listener Attachment
    // ===========================

    /**
     * Initialize event listeners for various elements.
     */
    const attachAllEventListeners = () => {
        // Handle form submission
        SELECTORS.searchForm.on('submit', handleFormSubmission);

        // Handle checkbox interactions
        SELECTORS.excludeAirlinesSelect.on('change', handleExcludedAirlinesChange);

        // Toggle IATA codes
        $('.switch-icon-container').on('click', switchIATACodes);

        // One-way trip checkbox change
        SELECTORS.oneWayTripCheckbox.on('change', handleOneWayTripChange);

        // Direct flight checkbox change
        SELECTORS.directFlightCheckbox.on('change', handleDirectFlightChange);

        // Flexible dates checkbox change
        SELECTORS.flexibleDatesCheckbox.on('change', handleFlexibleDatesChange);

        // Airline mode switch change
        SELECTORS.airlineModeSwitch.on('change', handleAirlineModeSwitchChange);

        // Help button tooltip toggle
        SELECTORS.helpBtn.on('click', toggleTooltip);

        // Confirm hotel tracker button click
        SELECTORS.confirmHotelTrackerBtn.on('click', handleConfirmHotelTracker);

        // Decline hotel tracker button click
        SELECTORS.cancelHotelTrackerBtn.on('click', handleCancelHotelTracker);

        // Attach event listener to suggestPriceBtn
        SELECTORS.suggestPriceBtn.on('click', suggestPriceLimit);

        // Attach event listener to advancedSettingsToggle
        SELECTORS.advancedSettingsToggle.on('click', handleAdvancedSettingsToggle);

        // Close tooltip when clicking outside
        $(document).on('click', function (event) {
            if (!$(event.target).closest('#helpBtn, #tooltip').length) {
                SELECTORS.tooltip.hide();
            }
        });
    };


    /**
     * Handle the toggle of the advanced settings section.
     */
    const handleAdvancedSettingsToggle = () => {
        const advancedSettings = document.getElementById('advancedSettings');
        const toggleButton = document.getElementById('advancedSettingsToggle');

        // Toggle the display of the advanced settings section
        if (advancedSettings.style.display === 'none' || !advancedSettings.style.display) {
            advancedSettings.style.display = 'block';
            toggleButton.classList.add('expanded'); // Add the 'expanded' class

            // Initialize select2 on the exclude airlines dropdown
            $j('#excludeAirlines').select2({
                placeholder: 'Select airlines to exclude',
                allowClear: true
            });

        } else {
            advancedSettings.style.display = 'none';
            toggleButton.classList.remove('expanded'); // Remove the 'expanded' class
        }
    };


    // Handle airlineModeSwitch
    document.getElementById('airlineModeSwitch').addEventListener('change', function () {
        const label = document.querySelector('label[for="airlineModeSwitch"]');
        if (this.checked) {
            label.textContent = 'Include only Airlines';
        } else {
            label.textContent = 'Exclude Airlines';
        }
    });
    

    // ===========================
    // Initialization Sequence
    // ===========================

    /**
     * Build form data from the current state.
     * @returns {Object} Form data object.
     */
    const buildFormData = () => {
        const outboundTimes = $(SELECTORS.outboundSlider).val();
        let inboundTimes = ['', ''];
        if (!SELECTORS.oneWayTripCheckbox.is(':checked')) {
            inboundTimes = $(SELECTORS.inboundSlider).val();
        }

        return {
            price: {
                iataCodeFrom: extractIATACode('iataCodeFrom'),
                iataCodeTo: extractIATACode('iataCodeTo'),
                flightType: SELECTORS.oneWayTripCheckbox.is(':checked') ? 'one-way' : 'return',
                maxPricePerPerson: SELECTORS.maxPricePerPerson.val(),
                currency: SELECTORS.currencyInput.val(),
                maxStops: parseInputValue(parseInt(SELECTORS.maxStopsInput.val())),
                nbrPassengers: parseInputValue(parseInt(SELECTORS.nbrPassengersInput.val())),
                depDateFrom: depDate_From,
                depDateTo: depDate_To,
                returnDateFrom: returnDate_From,
                returnDateTo: returnDate_To,
                dtimeFrom: outboundTimes[0],
                dtimeTo: outboundTimes[1],
                retDtimeFrom: inboundTimes[0],
                retDtimeTo: inboundTimes[1],
                maxFlightDuration: parseInputValue(parseFloat(SELECTORS.maxFlightDurationInput.val())) || '',
                excludedAirlines: SELECTORS.excludeAirlinesSelect.val() ? SELECTORS.excludeAirlinesSelect.val().join(',') : '',
                exclude: !airlineSelectionMode, // Set based on the switch state
                email: SELECTORS.emailInput.val(),
                token: generateToken(),
                lastFetchedPrice: 0,
                lowestFetchedPrice: 'null'
            }
        };
    };

    /**
     * Initialize the application.
     */
    const init = async () => {
        try {
            // Load airport and airline data
            [airportData, airlinesDict] = await Promise.all([
                loadData('readAirportsData', 'text'),
                loadData('readAirlinesData', 'json')
            ]);

            // Populate datalists
            populateDatalist('iataCodeFromList', airportData);
            populateDatalist('iataCodeToList', airportData);

            // Initialize autocomplete
            initializeAutocomplete();

            // Initialize sliders
            initializeSliders();

            // Initialize date picker
            initializeDatePicker();

            // Initialize Select2 for airlines dropdown
            initializeSelect2('Select airlines to exclude');

            // Apply URL parameters after data is loaded
            const queryParams = getQueryParams();
            if (queryParams.iataCodeTo && airportData[queryParams.iataCodeTo]) {
                SELECTORS.iataCodeTo.val(`${queryParams.iataCodeTo} - ${airportData[queryParams.iataCodeTo]}`).trigger('change');
            }

            // Update currency and location based on IP
            await updateCurrencyAndLocation();

            // Attach event listeners
            attachAllEventListeners();

            // Hide the Advanced Settings toggle initially
            SELECTORS.advancedSettingsToggle.hide();

        } catch (error) {
            console.error('Initialization error:', error);
        }
    };

    // Start the initialization process
    init();

});
