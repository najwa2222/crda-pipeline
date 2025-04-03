pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "najwa22/crda-app"
        KUBE_DIR = ".\\kubernetes"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                bat """
                    docker build -t %DOCKER_IMAGE%:%BUILD_ID% .
                    docker tag %DOCKER_IMAGE%:%BUILD_ID% %DOCKER_IMAGE%:latest
                """
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    bat """
                        docker login -u %DOCKER_USER% -p %DOCKER_PASS%
                        docker push %DOCKER_IMAGE%:%BUILD_ID%
                        docker push %DOCKER_IMAGE%:latest
                    """
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl apply -f %KUBE_DIR%\\mysql-secret.yaml
                    kubectl apply -f %KUBE_DIR%\\mysql-pv.yaml
                    kubectl apply -f %KUBE_DIR%\\mysql-configmap.yaml
                    kubectl apply -f %KUBE_DIR%\\mysql-deployment.yaml
                    
                    powershell "(Get-Content %KUBE_DIR%\\app-deployment.yaml) -replace 'IMAGE_TAG', '%BUILD_ID%' | Set-Content %KUBE_DIR%\\app-deployment.yaml"
                    kubectl apply -f %KUBE_DIR%\\app-deployment.yaml
                """
            }
        }
    }

    post {
        always {
            bat "docker rmi %DOCKER_IMAGE%:%BUILD_ID% || echo No image to delete"
        }
        failure {
            bat "kubectl get pods && kubectl describe pods"
        }
    }
}