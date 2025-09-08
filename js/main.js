$(document).ready(function() {
    // Cached jQuery Selectors
    const introduction = $('#introduction');
    const quizContent = $('#quiz-content');
    const resultsContent = $('#results');
    const startBtn = $('#start-btn');
    const restartBtn = $('#restart-btn');
    const shareBtn = $('#share-btn');
    const questionText = $('#question-text');
    const answerButtons = $('#answer-buttons');
    const progressText = $('#progress-text');
    const progressBarInner = $('#progress-bar-inner');

    // State Variables
    let questions = [];
    let archetypes = [];
    let traitInfo = {};
    let traits = [];
    let shuffledQuestions = [];
    let currentQuestionIndex = 0;
    let userScores = {};
    let traitChart = null; // To hold the chart instance
    let maxPossibleScores = {}; // To hold max scores for normalization

    // Fetch data and then initialize
    $.when(
        $.getJSON('questions.json'),
        $.getJSON('archetypes.json'),
        $.getJSON('traits.json')
    ).done(function(questionsData, archetypesData, traitsData) {
        questions = questionsData[0];
        archetypes = archetypesData[0];
        traitInfo = traitsData[0];

        traits = discoverTraits(archetypes, questions);
        maxPossibleScores = calculateMaxScores(questions);

        // Enable start button once data is loaded
        startBtn.prop('disabled', false).text('Start Quiz');
        // Check for shared results now that data is loaded
        checkForSharedResults();
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Failed to load JSON data:", textStatus, errorThrown);
        // Handle error if JSON files fail to load
        introduction.html('<h2>Oops!</h2><p>Could not load quiz data. Please try refreshing the page.</p>');
    });

    function discoverTraits(archetypes, questions) {
        const traitSet = new Set();
        archetypes.forEach(archetype => {
            Object.keys(archetype.fingerprint).forEach(trait => traitSet.add(trait));
        });
        questions.forEach(question => {
            question.answers.forEach(answer => {
                Object.keys(answer.scores).forEach(trait => traitSet.add(trait));
            });
        });
        return Array.from(traitSet).sort();
    }

    // Event Listeners
    startBtn.on('click', startQuiz);
    restartBtn.on('click', startQuiz); // Restart quiz functionality
    shareBtn.on('click', shareResults);
    answerButtons.on('click', 'button', selectAnswer);

    function startQuiz() {
        if (traitChart) {
            traitChart.destroy();
        }

        introduction.addClass('hidden');
        resultsContent.addClass('hidden');
        quizContent.removeClass('hidden');

        // Reset state
        currentQuestionIndex = 0;
        userScores = traits.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});
        shuffledQuestions = shuffleArray([...questions]);

        showNextQuestion();
    }

    function showNextQuestion() {
        if (currentQuestionIndex < shuffledQuestions.length) {
            updateProgressBar();
            const question = shuffledQuestions[currentQuestionIndex];
            questionText.text(question.question);
            answerButtons.empty();

            question.answers.forEach(answer => {
                const button = $('<button></button>').addClass('btn').text(answer.text);
                button.data('scores', answer.scores);
                answerButtons.append(button);
            });
        } else {
            endQuiz();
        }
    }

    function selectAnswer() {
        const selectedScores = $(this).data('scores');

        // Add scores to user's profile
        for (const trait in selectedScores) {
            if (userScores.hasOwnProperty(trait)) {
                userScores[trait] += selectedScores[trait];
            }
        }

        currentQuestionIndex++;
        showNextQuestion();
    }

    function updateProgressBar() {
        const progress = ((currentQuestionIndex) / shuffledQuestions.length) * 100;
        progressBarInner.css('width', `${progress}%`);
        progressText.text(`Question ${currentQuestionIndex + 1}/${shuffledQuestions.length}`);
    }

    function endQuiz() {
        quizContent.addClass('hidden');
        resultsContent.removeClass('hidden');

        const sortedResults = calculateResults();
        displayResults(sortedResults);
    }

    function calculateResults() {
        const normalizedPlayerScores = normalizeScores(userScores, maxPossibleScores);

        const results = archetypes.map(archetype => {
            let sumOfSquares = 0;
            traits.forEach(trait => {
                // Use 0 for missing traits in either player or archetype
                const playerTraitScore = normalizedPlayerScores[trait] || 0;
                const archetypeTraitScore = archetype.fingerprint[trait] || 0;
                sumOfSquares += Math.pow(playerTraitScore - archetypeTraitScore, 2);
            });
            const distance = Math.sqrt(sumOfSquares);

            return {
                name: archetype.name,
                score: distance, // Score is now distance
                description: archetype.description
            };
        });

        // Sort by score (distance) in ascending order (lower is better)
        results.sort((a, b) => a.score - b.score);
        return results;
    }

    function displayResults(sortedResults) {
        if (!sortedResults || sortedResults.length === 0) {
            $('#primary-name').text("Could not determine archetype.");
            $('#primary-description').text("Please try the quiz again.");
            return;
        }

        const primary = sortedResults[0];
        const secondaries = sortedResults.slice(1, 4);

        $('#primary-name').text(primary.name);
        $('#primary-description').text(primary.description);

        const secondaryList = $('#secondary-list');
        secondaryList.empty();
        secondaries.forEach(archetype => {
            secondaryList.append(`<li>${archetype.name}</li>`);
        });

        const normalizedPlayerScores = normalizeScores(userScores, maxPossibleScores);
        renderTraitChart(normalizedPlayerScores);
        renderTraitBars(normalizedPlayerScores);
    }

    function renderTraitChart(normalizedScores) {
        const ctx = document.getElementById('trait-chart').getContext('2d');
        const chartData = {
            labels: traits,
            datasets: [{
                label: 'Your Playstyle Scores',
                data: traits.map(trait => normalizedScores[trait] || 1),
                backgroundColor: 'rgba(106, 106, 255, 0.2)',
                borderColor: 'rgba(106, 106, 255, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(106, 106, 255, 1)'
            }]
        };

        traitChart = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: {
                scales: {
                    r: {
                        angleLines: {
                            display: true,
                            color: '#ddd'
                        },
                        grid: {
                            color: '#ddd'
                        },
                        pointLabels: {
                            font: {
                                size: 14
                            },
                            color: '#333'
                        },
                        ticks: {
                            display: false,
                            min: 1,
                            max: 5,
                            stepSize: 4 // Creates grid lines at 1 and 5
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hiding the legend as it's self-explanatory
                    }
                }
            }
        });
    }

    function renderTraitBars(normalizedScores) {
        const container = $('#trait-bars-container');
        container.empty(); // Clear previous bars more robustly

        traits.forEach(trait => {
            const score = normalizedScores[trait] || 1; // Default to 1 if score is missing
            const positionPercent = (score - 1) / 4 * 100;

            const info = traitInfo[trait] || {};
            const labels = info.labels || { left: 'Low', right: 'High' };
            const description = info.description || 'No description available.';

            let trailLeft, trailWidth;
            if (positionPercent >= 50) {
                trailLeft = 50;
                trailWidth = positionPercent - 50;
            } else {
                trailLeft = positionPercent;
                trailWidth = 50 - positionPercent;
            }

            const barHtml = `
                <div class="trait-bar-row">
                    <div class="trait-header">
                        <h4>${trait}</h4>
                        <div class="tooltip">
                            <span class="tooltip-icon">?</span>
                            <div class="tooltip-content">
                                <p>${description}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bar-track">
                        <div class="bar-trail" style="left: ${trailLeft}%; width: ${trailWidth}%;"></div>
                        <div class="bar-indicator" style="left: ${positionPercent}%;"></div>
                    </div>
                    <div class="bar-labels">
                        <span class="label-left">${labels.left}</span>
                        <span class="label-right">${labels.right}</span>
                    </div>
                </div>
            `;
            container.append(barHtml);
        });
    }

    function calculateMaxScores(allQuestions) {
        const maxScores = {}; // Initialize as empty object

        allQuestions.forEach(question => {
            const questionMaxes = {};

            // Find the max score for each trait within this question
            question.answers.forEach(answer => {
                for (const trait in answer.scores) {
                    if (!questionMaxes[trait] || answer.scores[trait] > questionMaxes[trait]) {
                        questionMaxes[trait] = answer.scores[trait];
                    }
                }
            });

            // Add the maxes from this question to the total max scores
            for (const trait in questionMaxes) {
                if (maxScores.hasOwnProperty(trait)) {
                    maxScores[trait] += questionMaxes[trait];
                } else {
                    maxScores[trait] = questionMaxes[trait];
                }
            }
        });

        return maxScores;
    }

    function normalizeScores(scores, maxScores) {
        const normalizedScores = {};

        for (const trait of traits) {
            const userScore = scores[trait] || 0;
            const maxScore = maxScores[trait] || 0;
            if (maxScore > 0) {
                // Apply formula: Normalized Value = 1 + 4 * (Score / Max Trait Score)
                normalizedScores[trait] = 1 + 4 * (userScore / maxScore);
            } else {
                // Avoid division by zero, default to base score of 1
                normalizedScores[trait] = 1;
            }
        }

        return normalizedScores;
    }

    // Fisher-Yates Shuffle Algorithm
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function encodeScores(scores) {
        // Pad with leading zero if needed to make each score 2 digits.
        return traits.map(trait => String(scores[trait] || 0).padStart(2, '0')).join('');
    }

    function decodeScores(encodedString) {
        const decodedScores = {};
        if (encodedString.length !== traits.length * 2) {
            // Can't reliably decode if length doesn't match, could be old URL
            console.error("Decoded string length doesn't match current trait count.");
            throw new Error("Invalid encoded string length.");
        }
        for (let i = 0; i < traits.length; i++) {
            const trait = traits[i];
            const scoreStr = encodedString.substring(i * 2, (i * 2) + 2);
            decodedScores[trait] = parseInt(scoreStr, 10);
        }
        return decodedScores;
    }

    function shareResults() {
        const data = encodeScores(userScores);
        const url = window.location.origin + window.location.pathname + '#/results/' + data;

        navigator.clipboard.writeText(url).then(() => {
            const originalText = shareBtn.text();
            shareBtn.text('Copied!');
            setTimeout(() => {
                shareBtn.text(originalText);
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
            alert('Failed to copy URL. Please copy it manually:\n' + url);
        });
    }

    function checkForSharedResults() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#/results/')) {
            // Can only process this after traits are discovered
            if (traits.length === 0) {
                console.log("Traits not discovered yet, deferring shared results check.");
                return;
            }
            const data = hash.substring('#/results/'.length);
            try {
                userScores = decodeScores(data);
                displayResultsFromScores();
            } catch (e) {
                console.error("Failed to parse shared results data:", e);
                introduction.addClass('hidden');
                quizContent.addClass('hidden');
                resultsContent.addClass('hidden');
                $('body').prepend('<div style="text-align: center; padding: 20px;"><h2>Invalid Share Link</h2><p>The link you followed seems to be broken or from a previous version of the quiz.</p><a href="/">Go to Quiz</a></div>');
            }
        }
    }

    function displayResultsFromScores() {
        // Ensure max scores are calculated if they haven't been
        if (Object.keys(maxPossibleScores).length === 0) {
            maxPossibleScores = calculateMaxScores(questions);
        }

        if (traitChart) {
            traitChart.destroy();
        }

        const sortedResults = calculateResults();
        displayResults(sortedResults);

        // Show results and hide other sections
        introduction.addClass('hidden');
        quizContent.addClass('hidden');
        resultsContent.removeClass('hidden');
    }

    // Initially disable start button until data is loaded
    startBtn.prop('disabled', true).text('Loading...');

    // Check for shared results on page load
    checkForSharedResults();
});
