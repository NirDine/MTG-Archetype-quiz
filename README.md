# MTG Commander Archetype Quiz

This project is a web-based quiz designed to help Magic: The Gathering players discover their preferred Commander (EDH) archetype. By answering a series of situational questions, the user's playstyle is analyzed and matched to one of several common Commander archetypes.

## How It Works

The quiz operates on a trait-based scoring system. The core mechanics are as follows:

### 1. The Trait System

Every decision in the quiz is mapped to six core playstyle traits:

-   **Pace:** Determines the speed of your strategy (Slow vs. Fast).
-   **Risk:** Reflects your comfort with high-risk, high-reward plays (Safe vs. Swingy).
-   **Interact:** Measures your focus on disrupting opponents versus advancing your own plan (Proactive vs. Reactive).
-   **Resource:** Indicates your focus on mana efficiency and card advantage (Efficient vs. Greedy).
-   **Presence:** Describes the visibility and impact of your threats (Subtle vs. Flashy).
-   **Social:** Shows how much you rely on diplomacy and table politics (Independent vs. Diplomatic).

### 2. Scoring

-   When the user starts the quiz, they are presented with a series of shuffled, multiple-choice questions.
-   Each answer has a predefined score associated with one or more of the six traits.
-   As the user answers questions, their scores for each trait are accumulated.

### 3. Archetype Matching

-   After the final question, the user's total scores for each trait are normalized to a common scale (1-5). This creates a unique "playstyle fingerprint" for the user.
-   This fingerprint is then compared against a list of predefined archetype fingerprints (found in `archetypes.json`).
-   The system uses a **Euclidean distance formula** to calculate the "distance" between the user's fingerprint and each archetype's fingerprint.
-   The archetype with the smallest distance is determined to be the user's **Primary Archetype**. The next closest matches are shown as runner-ups.

### 4. Results Visualization

The results are displayed using:

-   A **Radar Chart** (from Chart.js) to visually represent the user's playstyle fingerprint across the six traits.
-   **Trait Bars** that provide a more detailed look at each individual trait score and what it means.

## File Structure

The repository is organized as follows:

-   `index.html`: The main entry point of the application. Contains the HTML structure for the quiz and results pages.
-   `css/style.css`: Contains all the styles for the application.
-   `js/main.js`: The core logic of the quiz. This file handles data loading, state management, quiz progression, score calculation, and results display. It uses jQuery for DOM manipulation.
-   `archetypes.json`: A JSON file containing the list of Commander archetypes, including their name, description, and ideal trait "fingerprint."
-   `questions.json`: Contains all the questions for the quiz, along with the answers and their corresponding trait scores.
-   `traits.json`: Provides metadata for each of the six traits, such as their descriptive labels (e.g., "Slow" vs. "Fast") and tooltips.

