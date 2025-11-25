Feature: Upload files via the uploader page
  Scenario: Page loads correctly
    Given I have navigated to the uploader page
    Then I should see the extract file input field
    And I should see the mani file input field
    And I should see the submit button

  Scenario: Successfully upload files (happy path)
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131.csv" that matches the URL LAD code
    And I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000000_20250131.csv" that matches the URL LAD code
    And I click "Submit"
    Then I should see a "Success" message

  Scenario: Fail to upload files due to both files missing
    Given I have navigated to the uploader page
    And I click "Submit"
    Then I should see a "You need to fill in both fields" message
    And I should see a "You need to add a Extract file" message
    And I should see a "You need to add a Mani file" message

  Scenario: Fail to upload files due to missing manifest file
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131.csv" that matches the URL LAD code
    And I click "Submit"
    Then I should see a "You need to fill in both fields" message
    And I should see a "You need to add a Mani file" message

  Scenario: Fail to upload files due to missing extract file
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000000_20250131.csv" that matches the URL LAD code
    And I click "Submit"
    Then I should see a "You need to fill in both fields" message
    And I should see a "You need to add a Extract file" message

  Scenario: Upload fails due to manifest file not following naming convention
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131.csv" that matches the URL LAD code
    And I upload an incorrectly named non-zero byte manifest file "CTAX_MANI_E00000000_202501.csv"
    And I click "Submit"
    Then I should see a “Mani File name does not follow the right pattern” message

  Scenario: Upload fails due to extract file not following naming convention
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000000_20250131.csv" that matches the URL LAD code
    And I upload an incorrectly named non-zero byte extract file "CTAX_EXTRACT_E00000000_202501.csv"
    And I click "Submit"
    Then I should see a “Extract File name does not follow the right pattern” message

  Scenario: Upload fails due to manifest file not having .csv file extension
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131.csv" that matches the URL LAD code
    And I upload a non-zero byte manifest file "CTAX_MANI_E00000000_20250131" that does not have a .csv extension
    And I click "Submit"
    Then I should see a “Mani File name does not follow the right pattern” message

  Scenario: Upload fails due to extract file not having .csv file extension
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000000_20250131.csv" that matches the URL LAD code
    And I upload a non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131" that does not have a .csv extension
    And I click "Submit"
    Then I should see a “Extract File name does not follow the right pattern” message

  Scenario: Upload fails due to manifest file not matching URL LAD Code
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131.csv" that matches the URL LAD code
    And I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000001_20250131.csv" that does not match the URL LAD Code
    And I click "Submit"
    Then I should see a “File name does not contain matching LAD code” message

  Scenario: Upload fails due to extract file not matching URL LAD Code
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000000_20250131.csv" that matches the URL LAD code
    And I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000001_20250131.csv" that does not match the URL LAD Code
    And I click "Submit"
    Then I should see a “File name does not contain matching LAD code” message

  Scenario: Upload fails due to manifest and extract file names not matching
    Given I have navigated to the uploader page
    When I upload a correctly named non-zero byte extract file "CTAX_EXTRACT_E00000000_20250131.csv" that matches the URL LAD code
    And I upload a correctly named non-zero byte manifest file "CTAX_MANI_E00000000_20250130.csv" that matches the URL LAD code
    And I click "Submit"
    Then I should see a “File names do not match” message
