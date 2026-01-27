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
        closeThankYouModalBtn: $('#closeThankYouModal'),
        hotelTrackingModal: $('#hotelTrackingModal'),
        dateField: $('#dateField'),
        outboundTimeStartDisplay: $('#outboundTimeStartDisplay'),
        outboundTimeEndDisplay: $('#outboundTimeEndDisplay'),
        inboundTimeStartDisplay: $('#inboundTimeStartDisplay'),
        inboundTimeEndDisplay: $('#inboundTimeEndDisplay'),
        cabinClassInput: $('#cabinClass'),
        maxPricePerPerson: $('#maxPricePerPerson'),
        iataCodeFromList: $('#iataCodeFromList'),
        iataCodeToList: $('#iataCodeToList'),
        exploreSection: $('#exploreSection'),
        exploreHeading: $('#exploreHeading'),
        exploreCards: $('#exploreCards'),
    };

    const API_ENDPOINTS = {
        geolocation: '/api/geolocation',
        getClosestAirport: '/api/getClosestAirport',
        suggestPriceLimit: '/api/suggestPriceLimit',
        getCityByIATA: '/api/getCityByIATA',
        sheetyProxy: '/api/sheetyProxy',
        sendMail: '/api/sendEmail',
        readAirlinesData: 'airline_data.txt',
        topDestinations: '/api/topDestinations',
    };

    // ===========================
    // Global Variables
    // ===========================
    let airlinesDict = {};
    let selectedStartDate = '';
    let selectedEndDate = '';
    let depDate_From = '';
    let depDate_To = '';
    let returnDate_From = '';
    let returnDate_To = '';
    let globalTequilaResponse = null;
    let currency = '';
    let city = '';
    let redirectEmail = '';
    let redirectIataCodeTo = '';
    let redirectCurrency = '';
    let redirectCity = '';
    let redirectUrl = '';
    let redirected = false; // Global variable to track if the user has been redirected
    let airlineSelectionMode = false; // False for exclude mode, true for include mode
    let flatpickrInstance = null; // To store the Flatpickr instance

    // ===========================
    // Helper Functions
    // ===========================


    // Function to send iframe height to parent
    const scrollToTop = () => {
        // Send a message to request scrolling to top
        window.parent.postMessage({ action: 'scrollToTop' }, "https://www.robotize.no");
        console.log('Sending Scroll to Top to Wix');
    };

    /**
     * Extract the IATA code or city identifier from an input field.
     * @param {string} inputId 
     * @returns {string} Formatted identifier with type prefix if necessary.
     */
    const extractIATACode = (inputId) => {
        const inputValue = document.getElementById(inputId).value;
        if (!inputValue) {
            console.error('Input value not found');
            return '';
        }

        // Extract the IATA code (first three letters before the '-')
        const iataCodeMatch = inputValue.match(/^([A-Za-z]{3}) -/);
        if (iataCodeMatch) {
            const iataCode = iataCodeMatch[1].toUpperCase();

            // Check if "All Airports" is present in the string
            if (inputValue.includes("All Airports")) {
                console.log(`city:${iataCode}`);
                return `city:${iataCode}`; // Prepend 'city:' if it includes "All Airports"
            }
            console.log(iataCode);
            return iataCode; // Just return the IATA code
        }

        console.error('Invalid input format:', inputValue);
        return '';
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
            return "";
        }
        const day = dateObject.getDate().toString().padStart(2, '0');
        const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObject.getFullYear();
        return `${day}/${month}/${year}`;
    };

    /**
     * Parse query parameters from the URL and set the `redirected` flag if parameters exist.
     * @returns {Object} Query parameters as key-value pairs.
     */
    const getQueryParams = () => {
        const params = new URLSearchParams(window.location.search);
        const queryParams = {};
        let redirectedFlag = false;  // Initialize the redirected flag

        for (const [key, value] of params.entries()) {
            queryParams[key] = value;
        }

        // Check if the query params contain any relevant redirection data, excluding 'city'
        if (Object.keys(queryParams).length > 0) {
            if (queryParams.dateFrom || queryParams.dateTo || queryParams.email) {
                redirectedFlag = true;  // Set redirected to true if any relevant param exists
                console.log('User has been redirected');
            }
        }

        // Only set the redirected flag if there's a relevant parameter
        if (redirectedFlag) {
            redirected = true;
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
     * Choices.js instance for airlines dropdown.
     */
    let airlinesChoices = null;

    /**
     * Initialize Choices.js for the airlines dropdown.
     * @param {string} placeholder
     */
    const initializeChoices = (placeholder) => {
        // Destroy existing instance if it exists
        if (airlinesChoices) {
            airlinesChoices.destroy();
        }

        const element = document.getElementById('excludeAirlines');
        if (element) {
            airlinesChoices = new Choices(element, {
                placeholder: true,
                placeholderValue: placeholder,
                removeItemButton: true,
                searchEnabled: true,
                searchPlaceholderValue: 'Search airlines...',
                noResultsText: 'No airlines found',
                noChoicesText: 'No airlines available',
                itemSelectText: '',
                shouldSort: true,
                searchResultLimit: 50
            });
        }
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
            // Use direct DOM queries to ensure elements are found
            $('#outboundTimeStartDisplay').text(values[0]);
            $('#outboundTimeEndDisplay').text(values[1]);
        });

        // Inbound Time Range Slider
        initializeSlider(SELECTORS.inboundSlider, function (values, handle) {
            // Use direct DOM queries to ensure elements are found
            $('#inboundTimeStartDisplay').text(values[0]);
            $('#inboundTimeEndDisplay').text(values[1]);
        });
    };

    /**
     * Initialize the autocomplete functionality for IATA code and City fields.
     */
    const initializeAutocomplete = () => {
        $(".autocomplete-iata").autocomplete({
            appendTo: "body",
            source: function (request, response) {
                const term = request.term;
                if (term.length < 3) return; // Trigger only after 3 or more characters

                $.ajax({
                    url: '/api/airport-suggestions',
                    method: 'GET',
                    data: { term, limit: 10 },
                    success: function (data) {
                        if (data.data && data.data.locations && data.data.locations.length) {
                            // Log whether the data is cached or fetched
                            console.log('Data Source:', data.source);  // 'Cached' or 'Fetched'

                            // Filter to only keep items with type 'city' or 'airport'
                            const filteredLocations = data.data.locations.filter(location => location.type === 'city' || location.type === 'airport');

                            // Map the filtered data to the desired structure
                            const suggestions = filteredLocations.map(({ type, code, name }) => ({
                                label: type === 'city' 
                                    ? `${code} - ${name} All Airports` 
                                    : `${code} - ${name}`, 
                                type
                            }));

                            // Remove duplicates based on the label and return unique suggestions
                            const uniqueSuggestions = [...new Map(suggestions.map(s => [s.label, s])).values()];
                            console.log('Unique suggestions', uniqueSuggestions);

                            response(uniqueSuggestions); // Return unique suggestions
                        } else {
                            response([]); // No suggestions found
                        }
                    },
                    error: () => response([]) // Handle error
                });
            },
            minLength: 3,
            select: function (event, ui) {
                let { label, type } = ui.item;

                // Append "All Airports" only if it's a city and not already in the label
                if (type === 'city' && !label.includes('All Airports')) {
                    label = `${label} All Airports`;
                }

                $(this).val(label);

                // Update the IATA code field based on the input ID
                const iataCodeField = $(this).attr('id') === 'iataCodeFrom' 
                    ? SELECTORS.iataCodeFrom 
                    : SELECTORS.iataCodeTo;

                iataCodeField.val(label);
                return false; // Prevent default selection behavior
            }
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
    * Get location info based on the user's IP address.
     */
    const getLocationInfo = async () => {
        try {
            const response = await fetch(API_ENDPOINTS.geolocation);
            if (!response.ok) {
                // Geolocation is optional - fail silently if service unavailable
                console.log('Geolocation service unavailable. Users will enter location manually.');
                return;
            }
            const data = await response.json();

            // Store the currency if currency data is available
            if (data.currency && data.currency.code) {
                currency = data.currency.code;  // Store the currency in the global variable
            }

            // Update location fields based on geolocation data
            if (data.latitude && data.longitude) {
                await fetchClosestAirport(data.latitude, data.longitude);  // Optional: Use latitude and longitude for location
            }

        } catch (error) {
            // Geolocation is optional - fail silently
            console.log('Geolocation not available:', error.message);
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
                const airportName = tequilaData.name || 'Unknown Airport';
                const cityName = tequilaData.city || 'Unknown City';
                const countryName = tequilaData.country || 'Unknown Country';

                console.log(`Closest Airport: ${airportIATA} - ${airportName}, ${cityName}, ${countryName}`);

                // Update the IATA Code From field in the UI
                SELECTORS.iataCodeFrom.val(`${airportIATA} - ${airportName}`).trigger('change');

                // Fetch top destinations from the detected airport
                fetchTopDestinations(airportIATA);
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
     * Fetch top destinations from the user's detected airport.
     * @param {string} originCode - IATA code of the origin airport.
     */
    const fetchTopDestinations = async (originCode) => {
        try {
            const curr = SELECTORS.currencyInput.val() || 'NOK';
            const params = new URLSearchParams({ origin: originCode, currency: curr });
            const response = await fetch(`${API_ENDPOINTS.topDestinations}?${params.toString()}`);
            if (!response.ok) return;
            const destinations = await response.json();
            if (destinations && destinations.length > 0) {
                renderTopDestinations(destinations, originCode);
            }
        } catch (error) {
            console.log('Top destinations not available:', error.message);
        }
    };

    /**
     * Render top destination cards into the explore section.
     * @param {Array} destinations
     * @param {string} originCode
     */
    const renderTopDestinations = (destinations, originCode) => {
        SELECTORS.exploreHeading.text(`Explore from ${originCode}`);
        SELECTORS.exploreCards.empty();

        destinations.forEach(dest => {
            const card = $(`
                <div class="explore-card" data-city="${dest.cityCode}" data-name="${dest.cityName}">
                    <div class="explore-card-city">${dest.cityName}</div>
                    <div class="explore-card-country">${dest.countryName}</div>
                    <div class="explore-card-price">${dest.currency} ${dest.price}</div>
                </div>
            `);
            card.on('click', function () {
                const cityCode = $(this).data('city');
                const cityName = $(this).data('name');
                SELECTORS.iataCodeTo.val(`${cityCode} - ${cityName} All Airports`).trigger('change');
                $('html, body').animate({ scrollTop: SELECTORS.iataCodeTo.offset().top - 100 }, 400);
            });
            SELECTORS.exploreCards.append(card);
        });

        SELECTORS.exploreSection.show();
    };

    /**
     * Populate the airlines dropdown with options.
     * @param {Array} airlines
     */
    const updateExcludedAirlinesDropdown = (airlines) => {
        // Build choices array for Choices.js
        const choices = airlines.map(code => ({
            value: code,
            label: airlinesDict[code] || code,
            selected: false
        }));

        // If Choices instance exists, update it; otherwise initialize
        if (airlinesChoices) {
            airlinesChoices.clearStore();
            airlinesChoices.setChoices(choices, 'value', 'label', true);
        } else {
            // Clear and populate the native select first
            SELECTORS.excludeAirlinesSelect.empty();
            airlines.forEach(code => {
                const airlineName = airlinesDict[code] || code;
                SELECTORS.excludeAirlinesSelect.append(new Option(airlineName, code));
            });
            initializeChoices(airlineSelectionMode ? 'Select airlines to include' : 'Select airlines to exclude');
        }
    };


    /**
     * Suggest price limit by querying the backend API.
     */
    const suggestPriceLimit = async () => {
        // Validate required fields before making the API call
        const origin = extractIATACode('iataCodeFrom');
        const destination = extractIATACode('iataCodeTo');

        if (!origin) {
            SELECTORS.iataCodeFrom.focus();
            alert('Please select a departure airport.');
            return;
        }
        if (!destination) {
            SELECTORS.iataCodeTo.focus();
            alert('Please select a destination airport.');
            return;
        }
        if (!depDate_From) {
            flatpickrInstance.open();
            alert('Please select your travel dates.');
            return;
        }
        if (!SELECTORS.oneWayTripCheckbox.is(':checked') && !returnDate_From) {
            flatpickrInstance.open();
            alert('Please select a return date, or choose "One-way trip".');
            return;
        }

        SELECTORS.loader.show(); // Show the loading icon
        console.log("Max Flight Duration:",SELECTORS.maxFlightDurationInput.val()); // Log the max flight duration
        console.log("Max Stops:",SELECTORS.maxStopsInput.val()); // Log the max stops
        const params = new URLSearchParams({
            origin: origin,
            destination: destination,
            dateFrom: depDate_From,
            dateTo: depDate_To,
            returnFrom: returnDate_From,
            returnTo: returnDate_To,
            maxStops: SELECTORS.maxStopsInput.val() === "All" ? "" : SELECTORS.maxStopsInput.val(),
            maxFlyDuration: SELECTORS.maxFlightDurationInput.val(),
            flightType: SELECTORS.oneWayTripCheckbox.is(':checked') ? 'oneway' : 'return',
            currency: SELECTORS.currencyInput.val(),
            dtime_from: SELECTORS.outboundTimeStartDisplay.text(),
            dtime_to: SELECTORS.outboundTimeEndDisplay.text(),
            ret_dtime_from: SELECTORS.oneWayTripCheckbox.is(':checked') ? '' : SELECTORS.inboundTimeStartDisplay.text(),
            ret_dtime_to: SELECTORS.oneWayTripCheckbox.is(':checked') ? '' : SELECTORS.inboundTimeEndDisplay.text(),
            selected_cabins: SELECTORS.cabinClassInput.val()
        });
        console.log("Sending Current Price request with params:", params.toString());
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
        console.log('Tequila response:',globalTequilaResponse);

        if (tequilaResponse.data && tequilaResponse.data.length > 0) {
            const lowestPriceFlight = tequilaResponse.data[0];
            const roundedPrice = Math.ceil(lowestPriceFlight.price);
            SELECTORS.maxPricePerPerson.val(roundedPrice);

            const uniqueAirlines = [...new Set(tequilaResponse.data.flatMap(flight => flight.airlines))];
            updateExcludedAirlinesDropdown(uniqueAirlines);

            // Enable the Submit button since a matching flight was found
            SELECTORS.submitFormButton.prop('disabled', false);
        } else {
            const cabinVal = SELECTORS.cabinClassInput.val();
            const cabinHint = cabinVal !== 'M'
                ? ' Try switching cabin class to Economy, as not all routes offer premium cabins.'
                : '';
            alert('No flights available for the given parameters. Please adjust your search criteria.' + cabinHint);
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
                    subject: "Welcome to the Flight Robot",
                    body: `
                        Welcome to the Flight Robot!<br><br>
                        We will check prices for you daily, and let you know if there is a change.<br><br>
                        From: ${SELECTORS.iataCodeFrom.val()}<br>
                        To: ${SELECTORS.iataCodeTo.val()}<br>
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

    // Function to show the thank you modal
    const showThankYouModal = () => {
        console.log('Displaying thank you modal.');
        $('#thankYouModal').modal('show');
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

        // Validate airports before submission
        const origin = extractIATACode('iataCodeFrom');
        const destination = extractIATACode('iataCodeTo');
        if (!origin || !destination) {
            alert('Please select both departure and destination airports.');
            return;
        }
        if (!depDate_From) {
            alert('Please select your travel dates.');
            return;
        }

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
            redirectUrl = `https://hotels.robotize.no/?email=${redirectEmail}&currency=${redirectCurrency}&city=${redirectCity}&dateFrom=${depDate_From}&dateTo=${returnDate_From}`;
            console.log('Redirect URL:', redirectUrl);

            // Send email notification
            await sendEmailNotification(formData);

            // Scroll to top before showing the modal at the top
            scrollToTop();  

            
            // Initialize the modal based on whether the user has been redirected
            if (redirected) {
                // If user was redirected, show the thank you modal
                showThankYouModal();
            } else {
                // Otherwise, show the hotel tracking modal
                askForHotelTracking();
            }


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
            // Update the label text (support both old and new HTML structure)
            $('#outbound-timeRangeDisplay .time-label-text').text('Departure time');
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
            // Update the label text (support both old and new HTML structure)
            $('#outbound-timeRangeDisplay .time-label-text').text('Departure time');
            flatpickrInstance.set('mode', 'range');
        }
    };

    /**
     * Handle changes in the direct flight checkbox.
     */
    const handleDirectFlightChange = () => {
        if (SELECTORS.directFlightCheckbox.is(':checked')) {
            console.log("Direct flights only enabled!");

            // Disable the inputs and add the 'disabled-input' class
            SELECTORS.maxStopsInput.val('0').prop('disabled', true).addClass('disabled-input');
            console.log("Max Stops:",SELECTORS.maxStopsInput.val());
            console.log("Max Flight Duration before:",SELECTORS.maxFlightDurationInput.val());
            SELECTORS.maxFlightDurationInput.val('').prop('disabled', true).addClass('disabled-input');
            console.log("Max Flight Duration after:",SELECTORS.maxFlightDurationInput.val());

            // Remove the 'required' attribute when disabled
            SELECTORS.maxStopsInput.prop('required', false);
            SELECTORS.maxFlightDurationInput.prop('required', false);

        } else {
            console.log("Direct flights only disabled!");

            // Enable the inputs and remove the 'disabled-input' class
            SELECTORS.maxStopsInput.val('1').prop('disabled', false).removeClass('disabled-input');
            SELECTORS.maxFlightDurationInput.val('10').prop('disabled', false).removeClass('disabled-input');

            // Add the 'required' attribute when enabled
            SELECTORS.maxStopsInput.prop('required', true);
            SELECTORS.maxFlightDurationInput.prop('required', true);
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

        if (airlinesChoices) {
            if (airlineSelectionMode) {
                // Include mode: select all airlines
                const allChoices = airlinesChoices._currentState.choices;
                allChoices.forEach(choice => {
                    airlinesChoices.setChoiceByValue(choice.value);
                });
            } else {
                // Exclude mode: clear selection
                airlinesChoices.removeActiveItems();
            }
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
        window.open(redirectUrl, '_blank');    // Navigate to redirect to the other site in a new tab
        window.location.href = 'https://flights.robotize.no/';  // Navigate to the original URL to refresh the form
    };


    /**
     * Handle the "No" button click to reload the page.
     */
    const handleCancelHotelTracker = () => {
        console.log('User declined hotel tracking. Reloading the page.');
        window.location.href = 'https://flights.robotize.no/';  // Navigate to the original URL to refresh the form
    };


    /**
     * Handle the "Ok" button click to reload the page.
     */
    const handleThankYouButton = () => {
        console.log('User clicked OK. Reloading the page.');
        window.location.href = 'https://flights.robotize.no/';  // Navigate to the original URL to refresh the form
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
        // Get selected airlines from Choices.js instance
        const selectedAirlines = airlinesChoices ? airlinesChoices.getValue(true) : [];
        console.log('Selected Airlines: ', selectedAirlines);

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

        // Handle airline selection changes (Choices.js fires 'change' on the original element)
        document.getElementById('excludeAirlines').addEventListener('change', handleExcludedAirlinesChange);

        // Toggle IATA codes (support both old and new selectors)
        $('.switch-icon-container, .swap-btn').on('click', switchIATACodes);

        // One-way trip checkbox change
        SELECTORS.oneWayTripCheckbox.on('change', handleOneWayTripChange);

        // Direct flight checkbox change
        SELECTORS.directFlightCheckbox.on('change', handleDirectFlightChange);

        // Flexible dates checkbox change
        SELECTORS.flexibleDatesCheckbox.on('change', handleFlexibleDatesChange);

        // Airline mode switch change
        SELECTORS.airlineModeSwitch.on('change', handleAirlineModeSwitchChange);

        // Currency change - update suffix display
        SELECTORS.currencyInput.on('change', updateCurrencySuffix);

        // Help button tooltip toggle
        SELECTORS.helpBtn.on('click', toggleTooltip);

        // Confirm hotel tracker button click
        SELECTORS.confirmHotelTrackerBtn.on('click', handleConfirmHotelTracker);

        // Decline hotel tracker button click
        SELECTORS.cancelHotelTrackerBtn.on('click', handleCancelHotelTracker);

        // Decline hotel tracker button click
        SELECTORS.closeThankYouModalBtn.on('click', handleThankYouButton);

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
     * Update the currency suffix display when currency changes.
     */
    const updateCurrencySuffix = () => {
        const currencySuffix = $('#currencySuffix');
        if (currencySuffix.length) {
            currencySuffix.text(SELECTORS.currencyInput.val());
        }
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

            // Initialize Choices.js on the exclude airlines dropdown if not already done
            if (!airlinesChoices) {
                initializeChoices('Select airlines to exclude');
            }

        } else {
            advancedSettings.style.display = 'none';
            toggleButton.classList.remove('expanded'); // Remove the 'expanded' class
        }
    };   

    // ===========================
    // Initialization Sequence
    // ===========================

    /**
     * Build form data from the current state.
     * @returns {Object} Form data object.
     */
    const buildFormData = () => {
        // Retrieve slider values using noUiSlider's API
        const outboundTimes = SELECTORS.outboundSlider.noUiSlider.get(); // Returns an array [start, end]
        let inboundTimes = ['', ''];
        if (!SELECTORS.oneWayTripCheckbox.is(':checked')) {
            inboundTimes = SELECTORS.inboundSlider.noUiSlider.get();
        }

        // Log the retrieved times for debugging
        console.log('Outbound Times:', outboundTimes);
        console.log('Inbound Times:', inboundTimes);

        return {
            price: {
                iataCodeFrom: extractIATACode('iataCodeFrom'), // e.g., "airport:LHR" or "city:LON"
                iataCodeTo: extractIATACode('iataCodeTo'),     // e.g., "airport:JFK" or "city:NYC"
                flightType: SELECTORS.oneWayTripCheckbox.is(':checked') ? 'one-way' : 'return',
                maxPricePerPerson: SELECTORS.maxPricePerPerson.val(),
                currency: SELECTORS.currencyInput.val(),
                maxStops: SELECTORS.maxStopsInput.val() === "All" ? "" : SELECTORS.maxStopsInput.val(),
                nbrPassengers: parseInputValue(parseInt(SELECTORS.nbrPassengersInput.val())),
                depDateFrom: depDate_From,
                depDateTo: depDate_To,
                returnDateFrom: returnDate_From,
                returnDateTo: returnDate_To,
                dtimeFrom: outboundTimes[0], // Correctly retrieved
                dtimeTo: outboundTimes[1],   // Correctly retrieved
                retDtimeFrom: inboundTimes[0],
                retDtimeTo: inboundTimes[1],
                maxFlyDuration: SELECTORS.maxFlightDurationInput.val(),
                excludedAirlines: airlinesChoices ? airlinesChoices.getValue(true).join(',') : '',
                cabinClass: SELECTORS.cabinClassInput.val(),
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
            // Load airline data
            [airlinesDict] = await Promise.all([
                loadData('readAirlinesData', 'json')
            ]);

            // Initialize slider and picker
            setTimeout(() => {
                initializeSliders();
            }, 0);

            initializeDatePicker();
            
            // Apply URL parameters after data is loaded
            const queryParams = getQueryParams();
            console.log(queryParams);

            // Check if a city is provided in the URL and fetch suggestions from the backend
            if (queryParams.city) {
                const cityName = queryParams.city; // Get the city from the query parameters
                console.log("City from URL:", cityName);

                // Send a request to your backend API with the city name
                fetch(`/api/airport-suggestions?term=${cityName}&limit=10`)
                    .then(response => response.json())
                    .then(data => {
                        console.log('Backend Response:', data);
                        
                        // Ensure the response contains locations in the correct structure
                        if (data && data.data && data.data.locations && data.data.locations.length > 0) {
                            // Find the first item with type = 'city'
                            const cityData = data.data.locations.find(item => item.type === 'city');
                            
                            if (cityData) {
                                // Update the iataCodeTo field with the city data (formatted correctly)
                                SELECTORS.iataCodeTo.val(`${cityData.code} - ${cityData.name} All Airports`).trigger('change');
                                console.log('Updated city:', cityData.name);
                            } else {
                                console.log('No city data found in the locations.');
                            }
                        } else {
                            console.log('No locations returned from the backend');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching city data:', error);
                    });
            }


            // Check if both dateFrom and dateTo are in the URL and assign them
            if (queryParams.dateFrom && queryParams.dateTo) {
                selectedStartDate = new Date(queryParams.dateFrom);
                selectedEndDate = new Date(queryParams.dateTo);
                depDate_From = formatDate(selectedStartDate);
                depDate_To = formatDate(selectedStartDate); // Same as dateFrom for the departure date
                returnDate_From = formatDate(selectedEndDate);
                returnDate_To = formatDate(selectedEndDate); // Same as dateTo for return date

                // Update Flatpickr with the entire date range
                flatpickrInstance.setDate([selectedStartDate, selectedEndDate]);

                console.log('Updated depDate', depDate_From);
                console.log('Updated returnDate', returnDate_From);
            } else {
                console.log('Date parameters are missing in the URL');
            }

           // Fetch location info if currency is missing in the URL
            await getLocationInfo();  // Fetch geolocation data and store currency

            // Check if currency is already in the URL
            if (!queryParams.currency) {
                console.log("Currency not in the URL, updating from IP...");

                // If currency is fetched from IP, set it in the input
                if (currency) {
                    console.log("Currency fetched from IP:", currency);
                    SELECTORS.currencyInput.val(currency).trigger('change');  // Set the currency input if needed
                }
            } else {
                console.log("Currency is already in the URL, skipping IP update...");
                // Set the currency input based on the URL
                SELECTORS.currencyInput.val(queryParams.currency).trigger('change');
            }

            // Update currency suffix display
            updateCurrencySuffix();


            // Check if email is already in the URL
            if (queryParams.email) {
                console.log("Email is in the URL, setting it in the email input...");
                // Set the email input based on the URL
                SELECTORS.emailInput.val(queryParams.email);
            } else {
                console.log("Email is not in the URL");
            }


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


    window.addEventListener('load', () => {
        console.log('Window has loaded!');
        // Initialize Choices.js for airlines dropdown
        initializeChoices('Select airlines to exclude');
        // Initialize autocomplete
        initializeAutocomplete();
        console.log('Autocomplete initialized!');
    });

});
