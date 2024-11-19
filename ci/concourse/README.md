# CICD pipeline

This is a example of a basic pipeline witin concourse using YAML. 

### Useful tutorials

If you are new to Concourse, there is a useful [tutorial website](https://concoursetutorial.com) to help you get up to speed

## Prerequisites

### Install Fly CLI

Go to your concourse url (in this example we will use the CIAShared instance) in the bottom right hand corner click on your operating system icon to download the correct version of fly cli.

### Linux / MacOS install
Once downloaded, copy the fly binary into your path ($PATH), such as /usr/local/bin or ~/bin. Don't forget to also make it executable. For example,
```
sudo mkdir -p /usr/local/bin
sudo mv ~/Downloads/fly /usr/local/bin
sudo chmod 0755 /usr/local/bin/fly
```

### Windows Install

For Windows users, use this [article](https://stackoverflow.com/questions/23400030/windows-7-add-path) to see where to add fly in to the PATH.

## Usage

### Logging in

In order to use the fly command you need to create a target and login to be able to deploy our pipeline. 
```
fly --target=cia-shared login --concourse-url=https://concourse.cicd-shared.aws.onsdigital.uk/ --team-name=cia
```
- target - This is the local reference for your computer to target the correct team and concourse instance.
- login - fly command that we want to trigger.
- concourse-url - The URL to your concourse instance.
- team-name - The name of the concourse team you want to create your pipeline under.

### Setting a pipeline

Navigate to where your pipeline.yml file is located

` cd ci `

To Create or modify a pipeline, run the following command:

```
fly --target cia-shared set-pipeline --pipeline dev-pipeline --config pipeline.yml --load-vars-from env/config-variables.yml
```

- target - This is your local reference to the concourse instance you want to target (setup in the login step).
- set-pipeline - fly command you want to use to set a pipeline.
- pipeline - The name of the pipeline you want to create.
- config - the location of your pipeline file.
- load-vars-from - (Optional) If you have a variables file for your pipeline reference it here.

### Destroying a pipeline

To remove a pipeline run the following command:

```
fly --target irex-dev destroy-pipeline --pipeline dev-pipeline
```

- target - This is your local reference to the concourse instance you want to target (setup in the login step).
- destroy-pipeline - fly command you want to use to destroy a pipeline.
- pipeline - The name of the pipeline you want to destroy. 


## Concourse 

### How to use Secrets and Variables

To reference a secret or a variable within concourse your need to double bracket the variable name `((variable))` or secret name `((secret))`.

To declare a variable you can reference it within the `config-variables.yml` file. 

To declare a secret, you need to store the secret within AWS Secret Manager under the following format: 

```
/concourse/team_name/secret
```
- This secret will be available for all pipelines within that given team

```
/concourse/team_name/pipeline_name/secret
```
- This secret will be available only for pipelines within the given team and given pipeline
