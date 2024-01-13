    // Wait for the document to be ready before initializing Select2
    $(document).ready(function () {

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

        function parseInputValue(value) {
            return isNaN(value) ? "" : value;
        }

        // Initialize Select2 for the "IATA Code From" field
        $('#iataCodeFrom').select2({
            placeholder: 'Start typing to search...',
            allowClear: true,
            width: '100%'
        });

        // Initialize Select2 for the "IATA Code To" field
        $('#iataCodeTo').select2({
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
            populateDropdownWithSelect2(document.getElementById('iataCodeFrom'), airportData);
            populateDropdownWithSelect2(document.getElementById('iataCodeTo'), airportData);

            // Set default values for "From" and "To" fields
            $('#iataCodeFrom').val('OSL').trigger('change');
            $('#iataCodeTo').val('PMI').trigger('change');
        });

            // Listen to changes in the flight type dropdown
        $('#flightType').on('select2:select', function() {
        console.log("Selected value: ", $(this).val()); // Debugging line
          if ($(this).val() === 'one-way') {
                // Hide and remove required attribute from return date fields
                $('#returnDateFrom, #returnDateTo').hide().removeAttr('required');
                $('label[for="returnDateFrom"], label[for="returnDateTo"]').hide();
            } else {
                // Show and add required attribute to return date fields
                $('#returnDateFrom, #returnDateTo').show().attr('required', 'required');
                $('label[for="returnDateFrom"], label[for="returnDateTo"]').show();
            }
        });

    // Trigger change on page load in case the flightType is already set to 'one-way'
    $('#flightType').trigger('change');


        document.getElementById('sheetyForm').addEventListener('submit', function (event) {
            event.preventDefault();

            // Replace 'your-sheety-url' with your actual Sheety API endpoint
            let url = 'https://api.sheety.co/f3a65c5d3619ab6b57dcfe118df98456/flightDeals/prices';

            // Function to format dates as needed
            function formatDate(dateString) {
                const date = new Date(dateString);
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const formattedDate = `${day}/${month}/${date.getFullYear()}`;
                return formattedDate;
            }

            // Function to extract IATA code from Select2 option text
            function extractIATACode(elementId) {
                const selectElement = document.getElementById(elementId);
                const selectedOptionText = $(selectElement).select2('data')[0].text;
                const iataCode = selectedOptionText.split(' - ')[0];
                return iataCode.trim();
            }

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
                    returnDateFrom: formatDate(document.getElementById('returnDateFrom').value),
                    returnDateTo: formatDate(document.getElementById('returnDateTo').value),
                    nightsFrom: parseInputValue(parseInt(document.getElementById('nightsFrom').value)),
                    nightsTo: parseInputValue(parseInt(document.getElementById('nightsTo').value)),
                    maxFlightDuration: parseInputValue(parseFloat(document.getElementById('maxFlightDuration').value)),
                    email: document.getElementById('email').value
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
                    alert('Thank you for your submission! We will for prices check daily and let you know when we find a matching flight!.');
                    // Set default values for "From" and "To" fields
                    $('#iataCodeFrom').val('OSL').trigger('change');
                    $('#iataCodeTo').val('PMI').trigger('change');
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        });
    });