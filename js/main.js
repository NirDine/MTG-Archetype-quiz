$(document).ready(function() {
    // Cached jQuery Selectors
    const introduction = $('#introduction');
    const quizContent = $('#quiz-content');
    const resultsContent = $('#results');
    const startBtn = $('#start-btn');
    const restartBtn = $('#restart-btn');
    const questionText = $('#question-text');
    const answerButtons = $('#answer-buttons');
    const progressText = $('#progress-text');
    const progressBarInner = $('#progress-bar-inner');

    // State Variables
    let questions = [];
    let archetypes = [];
    let shuffledQuestions = [];
    let currentQuestionIndex = 0;
    let userScores = {};
    let traitChart = null; // To hold the chart instance
    let maxPossibleScores = {}; // To hold max scores for normalization
    const TRAITS = ["Pace", "Risk", "Interact", "Resource", "Presence", "Social"];

    // Fetch data and then initialize
    $.when(
        $.getJSON('questions.json'),
        $.getJSON('archetypes.json')
    ).done(function(questionsData, archetypesData) {
        questions = questionsData[0];
        archetypes = archetypesData[0];
        maxPossibleScores = calculateMaxScores(questions);
        // Enable start button once data is loaded
        startBtn.prop('disabled', false).text('Start Quiz');
    }).fail(function() {
        // Handle error if JSON files fail to load
        introduction.html('<h2>Oops!</h2><p>Could not load quiz data. Please try refreshing the page.</p>');
    });

    // Event Listeners
    startBtn.on('click', startQuiz);
    restartBtn.on('click', startQuiz); // Restart quiz functionality
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
        userScores = TRAITS.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});
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
            // End of quiz - transition to results
            // This will be implemented in the next step
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

    function cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0; // Avoid division by zero
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    function calculateResults() {
        const normalizedPlayerScores = normalizeScores(userScores, maxPossibleScores);
        const playerVector = TRAITS.map(trait => normalizedPlayerScores[trait]);

        const results = archetypes.map(archetype => {
            const archetypeVector = TRAITS.map(trait => archetype.fingerprint[trait]);
            const similarity = cosineSimilarity(playerVector, archetypeVector);

            return {
                name: archetype.name,
                // Convert similarity to percentage for easier handling later
                score: similarity,
                description: archetype.description
            };
        });

        // Sort by score (similarity) in descending order
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    function displayResults(sortedResults) {
        if (!sortedResults || sortedResults.length === 0) {
            $('#primary-name').text("Could not determine archetype.");
            $('#primary-description').text("Please try the quiz again.");
            return;
        }

        const topScore = sortedResults[0].score;
        // Check if the second score is at least 95% of the top score
        const isTie = sortedResults.length > 1 && (sortedResults[1].score / topScore) >= 0.95;

        const primaryNameEl = $('#primary-name');
        const primaryDescriptionEl = $('#primary-description');
        const secondaryList = $('#secondary-list');
        secondaryList.empty();

        if (isTie) {
            const primary1 = sortedResults[0];
            const primary2 = sortedResults[1];
            // If there's a tie, the "secondary" list starts from the 3rd result
            const secondaries = sortedResults.slice(2, 4);

            primaryNameEl.html(`${primary1.name} & ${primary2.name}`);
            primaryDescriptionEl.text("You have a hybrid playstyle, sharing traits from two distinct archetypes. You enjoy blending strategies and can adapt your approach depending on the game.");

            // Show scores for the tied primary archetypes in the description or name
            const tieDescription = `Your top matches are ${primary1.name} (${(primary1.score * 100).toFixed(0)}%) and ${primary2.name} (${(primary2.score * 100).toFixed(0)}%).`;
            primaryDescriptionEl.append(`<br><br><em>${tieDescription}</em>`);

            secondaries.forEach(archetype => {
                secondaryList.append(`<li>${archetype.name} <span class="score">(${(archetype.score * 100).toFixed(0)}%)</span></li>`);
            });

        } else {
            const primary = sortedResults[0];
            const secondaries = sortedResults.slice(1, 4);

            primaryNameEl.html(`${primary.name} <span class="score">(${(primary.score * 100).toFixed(0)}%)</span>`);
            primaryDescriptionEl.text(primary.description);

            secondaries.forEach(archetype => {
                secondaryList.append(`<li>${archetype.name} <span class="score">(${(archetype.score * 100).toFixed(0)}%)</span></li>`);
            });
        }

        renderTraitChart(userScores);
    }

    function renderTraitChart(scores) {
        const normalizedScores = normalizeScores(scores, maxPossibleScores);
        const ctx = document.getElementById('trait-chart').getContext('2d');
        const chartData = {
            labels: TRAITS,
            datasets: [{
                label: 'Your Playstyle Scores',
                data: TRAITS.map(trait => normalizedScores[trait]),
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

    function calculateMaxScores(allQuestions) {
        const maxScores = TRAITS.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});

        allQuestions.forEach(question => {
            const questionMaxes = TRAITS.reduce((acc, trait) => ({ ...acc, [trait]: 0 }), {});

            question.answers.forEach(answer => {
                for (const trait in answer.scores) {
                    if (questionMaxes.hasOwnProperty(trait)) {
                        if (answer.scores[trait] > questionMaxes[trait]) {
                            questionMaxes[trait] = answer.scores[trait];
                        }
                    }
                }
            });

            for (const trait in maxScores) {
                maxScores[trait] += questionMaxes[trait];
            }
        });

        return maxScores;
    }

    function normalizeScores(scores, maxScores) {
        const normalizedScores = {};

        for (const trait in scores) {
            if (maxScores.hasOwnProperty(trait) && maxScores[trait] > 0) {
                // Apply formula: Normalized Value = 1 + 4 * (Score / Max Trait Score)
                normalizedScores[trait] = 1 + 4 * (scores[trait] / maxScores[trait]);
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

    // Initially disable start button until data is loaded
    startBtn.prop('disabled', true).text('Loading...');
});
