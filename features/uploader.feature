Feature: Upload files via the uploader page

  Scenario: Successfully upload files (happy path)
    Given I have navigated to the uploader page
    When I upload an extract file
    And I upload a manifest file
    And I click "Submit"
    Then I should see a "Success" message
