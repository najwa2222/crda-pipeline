pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "najwa22/crda-app"
        KUBECONFIG = credentials('kubeconfig')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    docker.build("${DOCKER_IMAGE}:${env.BUILD_ID}")
                    
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                            docker login -u $DOCKER_USER -p $DOCKER_PASS
                            docker push ${DOCKER_IMAGE}:${env.BUILD_ID}
                        """
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                sh """
                    kubectl apply -f kubernetes/mysql-secret.yaml
                    kubectl apply -f kubernetes/mysql-pv.yaml
                    kubectl apply -f kubernetes/mysql-configmap.yaml
                    kubectl apply -f kubernetes/mysql-deployment.yaml
                    
                    # Update deployment with current build ID
                    sed -i 's|BUILD_ID|${env.BUILD_ID}|g' kubernetes/app-deployment.yaml
                    kubectl apply -f kubernetes/app-deployment.yaml
                """
            }
        }
    }

    post {
        always {
            sh "docker rmi ${DOCKER_IMAGE}:${env.BUILD_ID} || true"
        }
        failure {
            sh """
                kubectl describe pods
                kubectl logs --selector app=crda-app --all-containers
            """
        }
    }
}