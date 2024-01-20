// Wait for the document to be ready before initializing Select2
$(document).ready(function () {
    console.log("Loaded JS!");

    // Helper functions
    function extractIATACode(elementId) {
        const selectElement = document.getElementById(elementId);
        const selectedOptionText = $(selectElement).select2('data')[0].text;
        const iataCode = selectedOptionText.split(' - ')[0];
        return iataCode.trim();
    }

    function parseInputValue(value) {
        if (isNaN(value) || value === "NaN/NaN/NaN") {
            return "";
        }
        return value;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${day}/${month}/${date.getFullYear()}`;
        return formattedDate;
    }

    function calculateSuggestedPriceLimit(data) {
        return data.flights.reduce((acc, flight) => acc + flight.price, 0) / data.flights.length;
    }

    // Main functions
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

        try {
            const params = new URLSearchParams({
                fly_from: origin,
                fly_to: destination,
                date_from: startDate,
                date_to: endDate,
                max_stopovers: maxStops,
                max_fly_duration: maxFlyDuration,
                adults: 1,
                curr: 'NOK'
            });

            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'apikey': apiKey
                }
            });

            const data = await response.json();
            console.log('Tequila API response:', data);
            const suggestedPriceLimit = calculateSuggestedPriceLimit(data);
            document.getElementById('maxPricePerPerson').value = suggestedPriceLimit;

        } catch (error) {
            console.error('Error fetching data from Tequila API:', error);
        }
    }

    function generateToken() {
        let token;
        if (window.crypto && window.crypto.randomUUID) {
            token = window.crypto.randomUUID();
        } else {
            token = new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
        }
        console.log(token);
        return token;
    }

    // Event listeners
    $('#suggestPriceBtn').on('click', function() {
        console.log("Button clicked");
        suggestPriceLimit();
    });

    $('#sheetyForm').on('submit', function (event) {
        event.preventDefault();

        let formData = {
            price: {
                iataCodeFrom: extractIATACode('iataCodeFrom'),
                iataCodeTo: extractIATACode('iataCodeTo'),
                flightType: document.getElementById('flightType').value,
                maxPricePerPerson: document.getElementById('maxPricePerPerson').value,
                maxStops: parseInputValue(parseInt(document.getElementById('maxStops').value)),
                nbrPassengers: parseInputValue(parseInt(document.getElementById('nbrPassengers').value)),
                depDateFrom: formatDate(document.getElementById('depDateFrom').value),
                depDateTo: formatDate(document.getElementById('depDateTo').value),
                returnDateFrom: parseInputValue(document.getElementById('returnDateFrom').value),
                returnDateTo: parseInputValue(document.getElementById('returnDateTo').value),
                nightsFrom: parseInputValue(parseInt(document.getElementById('nightsFrom').value)),
                nightsTo: parseInputValue(parseInt(document.getElementById('nightsTo').value)),
                maxFlightDuration: parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value)),
                email: document.getElementById('email').value,
                token: generateToken(),
                lastFetchedPrice: 0
            }
        };

        console.log('Sending data to Sheety:', formData);

        // Sheety API function
        let url = 'https://api.sheety.co/f3a65c5d3619ab6b57dcfe118df98456/flightDeals/prices';
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
            document.getElementById('submissionMessage').style.display = 'block';
            document.getElementById('sheetyForm').reset();
            setTimeout(function () {
                document.getElementById('submissionMessage').style.display = 'none';
            }, 3000);
            alert('Thank you for your submission! We will check prices daily and let you know when we find a matching flight!');
            $('#iataCodeFrom').val('OSL').trigger('change');
            $('#iataCodeTo').val('PMI').trigger('change');
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
});
