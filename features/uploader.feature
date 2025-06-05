Feature: Upload files via the uploader page

  Scenario: Successfully upload files (happy path)
    Given I have navigated to the uploader page
    When I upload an extract file
    And I upload a manifest file
    And I click "Submit"
    Then I should see a "Success" message

  Scenario: Fail to upload files due to missing manifest file
    Given I have navigated to the uploader page
    When I upload an extract file
    And I click "Submit"
    Then I should see a "You need to fill in both fields" message
    And I should see a "You need to add a Mani file" message

  Scenario: Fail to upload files due to missing extract file
    Given I have navigated to the uploader page
    When I upload a manifest file
    And I click "Submit"
    Then I should see a "You need to fill in both fields" message
    And I should see a "You need to add a Extract file" message
