# CICD pipeline

This is a example of a basic aviator pipeline. 

"Aviator is a tool to template & merge YAML files in a convenient fashion based on a configuration file called aviator.yml. Aviator utilizes Spruce for templating and merging and therefore enables you to use all the Spruce operators in your YAML files."

### Useful tutorials

If you are new to Aviator, there is a useful [guidance](https://github.com/herrjulz/aviator) to help you get up to speed.

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

### Install Aviator 

You can install Aviator via home brew, There are other methods of installing the application found on there [github page](https://github.com/herrjulz/aviator)

```
brew tap julzdiverse/tools  
brew install aviator
```

## Usage

In order to use Aviator you need to create a base pipeline file which tells aviator which files to compile together to create your pipeline. In this example the file is called `avaitor.yml`.

### Logging in

In order to use the fly command you need to create a target and login to be able to deploy our pipeline. 
```
fly --target=cia-shared login --concourse-url=https://cicd.ciashared-prod.aws.onsdigital.uk/ --team-name=cia
```
- target - This is the local reference for your computer to target the correct team and concourse instance.
- login - fly command that we want to trigger.
- concourse-url - The URL to your concourse instance.
- team-name - The name of the concourse team you want to create your pipeline under.

### Setting a pipeline

Aviator still uses fly cli to create a pipeline instead of running the fly commands you can simply run 

```
aviator -f aviator.yml
```

The below variables are supplied in the aviator.yml fly command stage.

- name: The Name of the pipeline
- target: This is your local reference to the concourse instance you want to target (setup in the login step).
- config: the location of your pipeline file, the pipeline name aviator is going to create for you found in the `aviator.yml` file
- load_vars_from: (Optional) If you have a variables file for your pipeline reference it here.

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


