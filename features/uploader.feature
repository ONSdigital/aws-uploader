Feature: Error handling in the uploader

  Scenario: Error when uploading a file
    Given I have navigated to the uploader page
    # When I attempt to upload a file that is too large
    Then I should see "Council Tax - Test"
