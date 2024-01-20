$(document).ready(function () {
    console.log("Loaded Site!");

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
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${day}/${month}/${date.getFullYear()}`;
        console.log(formattedDate);
        return formattedDate;
    }

    function parseInputValue(value) {
        if (isNaN(value) || value === "NaN/NaN/NaN") {
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
        const origin = extractIATACode('iataCodeFrom');
        const destination = extractIATACode('iataCodeTo');
        const startDate = formatDate(document.getElementById('depDateFrom').value);
        const endDate = formatDate(document.getElementById('depDateTo').value);
        const maxStops = parseInputValue(parseInt(document.getElementById('maxStops').value));
        const maxFlyDuration = parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value));

        const url = 'https://tequila-api.kiwi.com/v2/search';
        const apiKey = '-MP6Bhp2klZefnaDsuhlENip9FX5-0Kc';
        console.log('Flight Duration: ', maxFlightDuration);
        console.log('Fly Duration:: ', maxFlyDuration);


        try {
            const params = new URLSearchParams({
                fly_from: origin,
                fly_to: destination,
                date_from: startDate,
                date_to: endDate,
                max_stopovers: maxStops,
                max_fly_duration: maxFlyDuration,
                adults: 1,
                curr: 'NOK',
                limit: 1
            });

            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'apikey': apiKey
                }
            });

            const currentPriceData = await response.json();
            console.log('Tequila API response:', currentPriceData);  // Log the response data to the console
            const suggestedPriceLimit = calculateSuggestedPriceLimit(currentPriceData);

            // Check if the suggested price limit is 0 and warn the user if so
            if (suggestedPriceLimit === 0) {
                // Display a warning message to the user
                alert("No flight available for the given parameters. Please consider increasing the maximum number of stops, flight duration or changing the dates.");
                // Optionally, you can also focus on the problematic input fields or highlight them
                document.getElementById('maxStops').focus();
                document.getElementById('maxStops').style.borderColor = 'red';
            } else {
                // If the price limit is not 0, proceed as normal
                document.getElementById('maxPricePerPerson').value = suggestedPriceLimit;
            }

        } catch (error) {
            console.error('Error fetching data from Tequila API:', error);
        }
    }

    // Example function to calculate suggested price limit (implement your own logic)
    function calculateSuggestedPriceLimit(currentPriceData) {
        // Example: return the average price
        if(currentPriceData && currentPriceData.data && currentPriceData.data.length > 0) {
            const firstItem = currentPriceData.data[0];
            console.log('First item data:', firstItem);
            return firstItem.price;
        } else {
            console.log('No data found in the response');
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

    // Change event listener for flightType
    $('#flightType').change(function() {
        console.log("Standard change event selected value:", $(this).val());
        if ($(this).val() === 'one-way') {
            console.log("Removing the fields.");
            $('#returnDateFrom, #returnDateTo').hide().removeAttr('required');
            $('label[for="returnDateFrom"], label[for="returnDateTo"]').hide();
        } else {
            console.log("Adding the fields.");
            $('#returnDateFrom, #returnDateTo').show().attr('required', 'required');
            $('label[for="returnDateFrom"], label[for="returnDateTo"]').show();
        }
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

        // Sheety API function
        let url = 'https://api.sheety.co/f3a65c5d3619ab6b57dcfe118df98456/flightDeals/prices';
        let formData = {
            price: {
                iataCodeFrom: extractIATACode('iataCodeFrom'),
                iataCodeTo: extractIATACode('iataCodeTo'),
                flightType: document.getElementById('flightType').value,
                maxPricePerPerson: document.getElementById('maxPricePerPerson').value,
                maxStops: parseInputValue(parseInt(document.getElementById('maxStops').value)),
                nbrPassengers: parseInputValue(parseInt(document.getElementById('nbrPassengers').value)),
                depDateFrom: parseInputValue(document.getElementById('depDateFrom').value),
                depDateTo: parseInputValue(document.getElementById('depDateTo').value),
                returnDateFrom: parseInputValue(document.getElementById('returnDateFrom').value),
                returnDateTo: parseInputValue(document.getElementById('returnDateTo').value),
                maxFlightDuration: parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value)),
                email: document.getElementById('email').value,
                token: generateToken(),  // Generate and include the unique token
                lastFetchedPrice: 0
            }
        };

        console.log('Sending data to Sheety:', formData);
        fetch(url, {
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
